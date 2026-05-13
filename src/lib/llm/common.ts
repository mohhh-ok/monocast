import type { LlmId } from "@/config.shared";
import { anthropicCommon } from "./adapters/anthropic/common";
import { geminiCommon } from "./adapters/gemini/common";
import { ollamaCommon } from "./adapters/ollama/common";
import { openaiCommon } from "./adapters/openai-compat/common";
import type { LlmCommon } from "./adapters/types";

export const LLM_COMMON: Record<LlmId, LlmCommon> = {
  anthropic: anthropicCommon,
  openai: openaiCommon,
  gemini: geminiCommon,
  ollama: ollamaCommon,
};
