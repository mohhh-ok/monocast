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
  } catch {
    return { programs: [] };
  }
}

async function save(store: Store): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

export async function listPrograms(): Promise<Program[]> {
  const s = await load();
  // 古い順（作成順）に並べてラジオの流れにする
  return s.programs.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addProgram(p: Program): Promise<void> {
  const s = await load();
  s.programs.push(p);
  await save(s);
}

export async function removeProgram(id: string): Promise<void> {
  const s = await load();
  const target = s.programs.find((x) => x.id === id);
  s.programs = s.programs.filter((x) => x.id !== id);
  await save(s);
  if (target) {
    const file = path.join(process.cwd(), "public", target.audioUrl);
    await fs.unlink(file).catch(() => {});
  }
}

export async function countPrograms(): Promise<number> {
  return (await listPrograms()).length;
}
