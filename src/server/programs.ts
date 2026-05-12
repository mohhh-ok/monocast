import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pickAdapter } from "@/lib/llm";
import { log } from "@/lib/log";
import { produceProgram } from "@/lib/produce";
import { listPrograms, removeProgram, type Program } from "@/lib/queue";

let inFlight: Promise<GenerateResult> | null = null;

export type GenerateResult =
  | { status: "ok"; program: Program }
  | { status: "empty" }
  | { status: "already-running" }
  | { status: "error"; message: string };

export const generateProgramFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<GenerateResult> => {
    if (inFlight) return { status: "already-running" };

    const task = (async (): Promise<GenerateResult> => {
      const adapter = await pickAdapter();
      const r = await produceProgram(adapter);
      if (r.status === "empty") return { status: "empty" };
      return { status: "ok", program: r.program };
    })().finally(() => {
      inFlight = null;
    });
    inFlight = task;

    try {
      return await task;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("produce", `失敗: ${message}`);
      if (err instanceof Error && err.stack) log.error("produce", err.stack);
      return { status: "error", message };
    }
  },
);

export const dismissProgramFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await removeProgram(data.id);
  });

export const listProgramsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ programs: Program[] }> => {
    const programs = await listPrograms();
    return { programs };
  },
);
