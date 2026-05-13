import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withResolvedActiveProfile } from "@/config";
import { formatErrorChain } from "@/lib/error";
import { pickAdapter } from "@/lib/llm";
import { ProduceAbortedError, produceProgram, type ProducePhase } from "@/lib/produce";
import { listPrograms, removeProgram, type Program } from "@/lib/queue";

/** 進行中の番組生成タスクの状態。1本だけしか走らない前提。 */
type InFlight = {
  controller: AbortController;
  phase: ProducePhase;
  profileId: string;
};

let inFlight: InFlight | null = null;

/** 進行中タスクの現状を読み取り専用で返す（updateConfigFn から参照される）。 */
export function getInFlightSnapshot(): { phase: ProducePhase; profileId: string } | null {
  if (!inFlight) return null;
  return { phase: inFlight.phase, profileId: inFlight.profileId };
}

/** 進行中タスクを中断する。reason は signal.reason に乗せて produce 側に伝える。 */
export function cancelInFlight(reason: string): boolean {
  if (!inFlight) return false;
  inFlight.controller.abort(reason);
  return true;
}

export type GenerateResult =
  | { status: "ok"; program: Program }
  | { status: "empty"; reason: "no-sources" | "no-fresh" }
  | { status: "already-running" }
  | { status: "aborted"; reason: string }
  | { status: "error"; message: string };

export const generateProgramFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<GenerateResult> => {
    if (inFlight) return { status: "already-running" };

    // ランダム選択中なら 1 本分だけ実プロファイルに解決する。中の `getConfig` は
    // すべてその id を返すので、ニュース取得 / LLM / TTS が違うプロファイルから
    // 混ざることはない。
    return withResolvedActiveProfile(async (profileId): Promise<GenerateResult> => {
      const controller = new AbortController();
      const state: InFlight = { controller, phase: "news", profileId };
      inFlight = state;

      try {
        const adapter = await pickAdapter();
        const r = await produceProgram(adapter, {
          signal: controller.signal,
          onPhase: (phase) => {
            // inFlight が既に置き換わっていれば無視（基本起きないが安全側に）。
            if (inFlight === state) state.phase = phase;
          },
        });
        if (r.status === "empty") return { status: "empty", reason: r.reason };
        return { status: "ok", program: r.program };
      } catch (err) {
        if (err instanceof ProduceAbortedError) {
          const reason =
            typeof controller.signal.reason === "string"
              ? controller.signal.reason
              : err.message;
          return { status: "aborted", reason };
        }
        return { status: "error", message: formatErrorChain(err).message };
      } finally {
        if (inFlight === state) inFlight = null;
      }
    });
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
