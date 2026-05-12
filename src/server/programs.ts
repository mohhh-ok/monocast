import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { produceProgram } from "@/lib/produce";
import { listPrograms, removeProgram, type Program } from "@/lib/queue";
import { getConfig } from "@/config";

let inFlight: Promise<Program> | null = null;

export type GenerateResult =
  | { status: "ok"; program: Program }
  | { status: "already-running" }
  | { status: "error"; message: string };

export const generateProgramFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<GenerateResult> => {
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
