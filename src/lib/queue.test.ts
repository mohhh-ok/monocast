import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addProgram,
  countPrograms,
  listPrograms,
  removeProgram,
  updateProgram,
} from "./queue";
import type { Program } from "./queue.types";

// データディレクトリは MONOCAST_DATA_DIR で一時ディレクトリへ差し替える
// （dataPath() が呼び出し時に解決するので、静的 import のままで安全）。
let tmpDir: string;

const dataFile = () => path.join(tmpDir, "queue.json");

function makeProgram(over: Partial<Program> = {}): Program {
  return {
    id: "p1",
    title: "番組1",
    body: "本文",
    audioSegments: [],
    expectedSegmentCount: 3,
    durationSec: 0,
    createdAt: "2026-06-04T00:00:00.000Z",
    sources: [],
    llm: { id: "ollama", label: "Fake", model: "fake-model" },
    ...over,
  };
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "monocast-queue-test-"));
  vi.stubEnv("MONOCAST_DATA_DIR", tmpDir);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });
});

describe("queue", () => {
  it("ファイル未作成なら空配列を返す", async () => {
    expect(await listPrograms()).toEqual([]);
    expect(await countPrograms()).toBe(0);
  });

  it("addProgram した番組が listPrograms で返る", async () => {
    const p = makeProgram();
    await addProgram(p);
    expect(await listPrograms()).toEqual([p]);
    expect(await countPrograms()).toBe(1);
  });

  it("listPrograms は createdAt の古い順に並べる", async () => {
    const newer = makeProgram({ id: "b", createdAt: "2026-06-04T12:00:00.000Z" });
    const older = makeProgram({ id: "a", createdAt: "2026-06-04T06:00:00.000Z" });
    await addProgram(newer);
    await addProgram(older);
    const list = await listPrograms();
    expect(list.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("updateProgram は指定 id だけを部分更新する", async () => {
    await addProgram(makeProgram({ id: "a", title: "A" }));
    await addProgram(makeProgram({ id: "b", title: "B" }));
    await updateProgram("a", { title: "A2", durationSec: 42 });
    const list = await listPrograms();
    expect(list.find((p) => p.id === "a")).toMatchObject({ title: "A2", durationSec: 42, body: "本文" });
    expect(list.find((p) => p.id === "b")).toMatchObject({ title: "B" });
  });

  it("updateProgram は存在しない id には何もしない", async () => {
    await addProgram(makeProgram({ id: "a" }));
    await updateProgram("missing", { title: "X" });
    expect(await listPrograms()).toEqual([makeProgram({ id: "a" })]);
  });

  it("removeProgram は番組と音声ディレクトリを削除する", async () => {
    await addProgram(makeProgram({ id: "a" }));
    const audioDir = path.join(tmpDir, "audio", "a");
    await fs.mkdir(audioDir, { recursive: true });
    await fs.writeFile(path.join(audioDir, "seg-000.wav"), "dummy");

    await removeProgram("a");

    expect(await listPrograms()).toEqual([]);
    await expect(fs.stat(audioDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("並行 addProgram でも全件が失われず保存される", async () => {
    const programs = Array.from({ length: 10 }, (_, i) =>
      makeProgram({ id: `p${i}`, createdAt: `2026-06-04T00:00:0${i}.000Z` }),
    );
    await Promise.all(programs.map((p) => addProgram(p)));
    const list = await listPrograms();
    expect(list.map((p) => p.id).sort()).toEqual(programs.map((p) => p.id).sort());
  });

  it("queue.json が壊れていたら warn を出して空として扱う", async () => {
    await fs.writeFile(dataFile(), "{ broken json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await listPrograms()).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[queue] load failed:", expect.anything());
  });

  it("保存される JSON は { programs: [...] } 形式", async () => {
    await addProgram(makeProgram({ id: "a" }));
    const raw = JSON.parse(await fs.readFile(dataFile(), "utf8"));
    expect(raw).toEqual({ programs: [makeProgram({ id: "a" })] });
  });
});
