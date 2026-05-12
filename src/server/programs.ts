import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formatErrorChain } from "@/lib/error";
import { pickAdapter } from "@/lib/llm";
import { produceProgram } from "@/lib/produce";
import { listPrograms, removeProgram, type Program } from "@/lib/queue";

let inFlight: Promise<GenerateResult> | null = null;

export type GenerateResult =
  | { status: "ok"; program: Program }
  | { status: "empty"; reason: "no-sources" | "no-fresh" }
  | { status: "already-running" }
  | { status: "error"; message: string };

export const generateProgramFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<GenerateResult> => {
    if (inFlight) return { status: "already-running" };

    const task = (async (): Promise<GenerateResult> => {
      const adapter = await pickAdapter();
      const r = await produceProgram(adapter);
      if (r.status === "empty") return { status: "empty", reason: r.reason };
      return { status: "ok", program: r.program };
    })().finally(() => {
      inFlight = null;
    });
    inFlight = task;

    try {
      return await task;
    } catch (err) {
      return { status: "error", message: formatErrorChain(err).message };
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
