"use server";

import { produceProgram } from "@/lib/produce";
import { removeProgram, type Program } from "@/lib/queue";
import { getConfig } from "@/config";

let inFlight: Promise<Program> | null = null;

export type GenerateResult =
  | { status: "ok"; program: Program }
  | { status: "already-running" }
  | { status: "error"; message: string };

export async function generateProgram(): Promise<GenerateResult> {
  if (inFlight) return { status: "already-running" };

  const { llmProvider } = await getConfig();
  const task = produceProgram(llmProvider).finally(() => {
    inFlight = null;
  });
  inFlight = task;

  try {
    const program = await task;
    return { status: "ok", program };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function dismissProgram(id: string): Promise<void> {
  await removeProgram(id);
}
