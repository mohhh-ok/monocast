import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pickAdapter } from "@/lib/llm";
import { produceProgram } from "@/lib/produce";
import { listPrograms, removeProgram, type Program } from "@/lib/queue";

function describeError(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  const seen = new Set<unknown>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      const code = (cur as Error & { code?: string }).code;
      parts.push(code ? `${cur.message} [${code}]` : cur.message);
      cur = (cur as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(" <- ");
}

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
      return { status: "error", message: describeError(err) };
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
