import { getConfig } from "@/config";
import { getEnv } from "@/lib/env";
import { createAnthropicAdapter } from "./adapters/anthropic";
import { createGeminiAdapter } from "./adapters/gemini";
import { createOpenAiCompatAdapter } from "./adapters/openai-compat";
import type { LlmAdapter, LlmId } from "./types";

export type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput, LlmId } from "./types";

/** 設定で選択されている LLM 群を adapter として返す。 */
export async function pickAdapters(): Promise<LlmAdapter[]> {
  const cfg = await getConfig();
  const env = getEnv();
  const adapters: LlmAdapter[] = [];

  for (const id of cfg.selectedLlms) {
    adapters.push(buildAdapter(id, cfg, env));
  }
  return adapters;
}

type CfgLike = Awaited<ReturnType<typeof getConfig>>;
type EnvLike = ReturnType<typeof getEnv>;

function buildAdapter(id: LlmId, cfg: CfgLike, env: EnvLike): LlmAdapter {
  switch (id) {
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY が設定されていません");
      }
      return createAnthropicAdapter({ model: cfg.anthropicModel });
    case "openai":
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY が設定されていません");
      }
      return createOpenAiCompatAdapter({
        id: "openai",
        label: `OpenAI (${cfg.openaiModel})`,
        baseUrl: "https://api.openai.com/v1",
        model: cfg.openaiModel,
        apiKey: env.OPENAI_API_KEY,
      });
    case "gemini":
      if (!env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY が設定されていません");
      }
      return createGeminiAdapter({
        model: cfg.geminiModel,
        apiKey: env.GEMINI_API_KEY,
      });
    case "ollama":
      return createOpenAiCompatAdapter({
        id: "ollama",
        label: `Ollama (${cfg.ollamaModel})`,
        baseUrl: `${cfg.ollamaUrl.replace(/\/$/, "")}/v1`,
        model: cfg.ollamaModel,
      });
  }
}
