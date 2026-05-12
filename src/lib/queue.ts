import { promises as fs } from "node:fs";
import path from "node:path";
import type { Program } from "./queue.types";

export type { Program };

const DATA_FILE = path.join(process.cwd(), "data", "queue.json");

type Store = { programs: Program[] };

async function load(): Promise<Store> {
  try {
    const buf = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(buf);
  } catch (err) {
    // ファイル未作成はノーマル。それ以外（パース失敗など）は呼び出し元で握り潰さず
    // ログだけ残して空を返す（書き込みがアトミックなので通常は起きない想定）。
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn("[queue] load failed:", err);
    }
    return { programs: [] };
  }
}

async function save(store: Store): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  // tmp に書いて rename することで、読み手が部分書き込み中の JSON を見ないようにする。
  // 同一 FS 上の rename は POSIX でアトミック。
  const tmp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2));
  await fs.rename(tmp, DATA_FILE);
}

// プロセス内で load → mutate → save を直列化し、lost update を防ぐ。
let writeChain: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

export async function listPrograms(): Promise<Program[]> {
  const s = await load();
  // 古い順（作成順）に並べてラジオの流れにする
  return s.programs.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addProgram(p: Program): Promise<void> {
  await runExclusive(async () => {
    const s = await load();
    s.programs.push(p);
    await save(s);
  });
}

/** 指定 id の番組を patch で部分更新する。番組が存在しない場合は何もしない。 */
export async function updateProgram(
  id: string,
  patch: Partial<Program>,
): Promise<void> {
  await runExclusive(async () => {
    const s = await load();
    const idx = s.programs.findIndex((x) => x.id === id);
    if (idx < 0) return;
    s.programs[idx] = { ...s.programs[idx], ...patch };
    await save(s);
  });
}

export async function removeProgram(id: string): Promise<void> {
  await runExclusive(async () => {
    const s = await load();
    s.programs = s.programs.filter((x) => x.id !== id);
    await save(s);
  });
  const dir = path.join(process.cwd(), "public", "audio", id);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

export async function countPrograms(): Promise<number> {
  return (await listPrograms()).length;
}
