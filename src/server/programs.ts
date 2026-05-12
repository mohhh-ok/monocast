import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pickAdapters } from "@/lib/llm";
import { produceProgram } from "@/lib/produce";
import { listPrograms, removeProgram, type Program } from "@/lib/queue";

let inFlight: Promise<GenerateResult> | null = null;

export type GenerateResult =
  | { status: "ok"; programs: Program[] }
  | { status: "empty" }
  | { status: "already-running" }
  | { status: "error"; message: string };

export const generateProgramFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<GenerateResult> => {
    if (inFlight) return { status: "already-running" };

    const task = (async (): Promise<GenerateResult> => {
      const adapters = await pickAdapters();
      if (adapters.length === 0) {
        return {
          status: "error",
          message: "使用する LLM が選択されていません。設定から 1 つ以上選んでください。",
        };
      }

      const produced: Program[] = [];
      let sawEmpty = false;
      for (const adapter of adapters) {
        const r = await produceProgram(adapter);
        if (r.status === "ok") produced.push(r.program);
        else sawEmpty = true;
      }
      if (produced.length === 0) {
        return sawEmpty ? { status: "empty" } : { status: "empty" };
      }
      return { status: "ok", programs: produced };
    })().finally(() => {
      inFlight = null;
    });
    inFlight = task;

    try {
      return await task;
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
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
