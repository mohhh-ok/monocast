import { z } from "zod";

export const LLM_IDS = ["anthropic", "openai", "gemini", "ollama"] as const;
export type LlmId = (typeof LLM_IDS)[number];

export const ConfigSchema = z.object({
  /** 番組生成に使う LLM。複数選択で N 本生成される。 */
  selectedLlms: z.array(z.enum(LLM_IDS)).default(["anthropic"]),
  anthropicModel: z.string().min(1).default("claude-haiku-4-5"),
  openaiModel: z.string().min(1).default("gpt-4o-mini"),
  geminiModel: z.string().min(1).default("gemini-1.5-flash"),
  ollamaUrl: z.string().url().default("http://localhost:11434"),
  ollamaModel: z.string().min(1).default("qwen2.5:7b-instruct"),
  voicevoxUrl: z.string().url().default("http://localhost:50021"),
  voicevoxSpeaker: z.coerce.number().int().nonnegative().default(2),
  // null = 全ソース有効（デフォルト）、配列 = 明示選択、[] = 全 OFF
  enabledSources: z.array(z.string()).nullable().default(null),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
