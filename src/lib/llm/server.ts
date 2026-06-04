import { getConfig } from "@/config";
import { getEnv } from "@/lib/env";
import { createAnthropicAdapter } from "./adapters/anthropic/server";
import { createGeminiAdapter } from "./adapters/gemini/server";
import { createOllamaAdapter } from "./adapters/ollama/server";
import { createOpenAiCompatAdapter } from "./adapters/openai-compat/server";
import type { LlmAdapter, LlmId } from "./adapters/types";

export type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput, LlmId } from "./adapters/types";

/** 設定で選択されている LLM を adapter として返す。 */
export async function pickAdapter(): Promise<LlmAdapter> {
  const cfg = await getConfig();
  const env = getEnv();
  return buildAdapter(cfg.selectedLlm, cfg, env);
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
      return createOllamaAdapter({
        baseUrl: env.OLLAMA_URL,
        model: cfg.ollamaModel,
      });
  }
}
