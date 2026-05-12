import { z } from "zod";

export const LLM_IDS = ["anthropic", "openai", "gemini", "ollama"] as const;
export type LlmId = (typeof LLM_IDS)[number];

export const TTS_IDS = ["voicevox", "say"] as const;
export type TtsId = (typeof TTS_IDS)[number];

export const ConfigSchema = z.object({
  /** 番組生成に使う LLM。 */
  selectedLlm: z.enum(LLM_IDS).default("anthropic"),
  anthropicModel: z.string().min(1).default("claude-haiku-4-5"),
  openaiModel: z.string().min(1).default("gpt-4.1-nano"),
  geminiModel: z.string().min(1).default("gemini-2.5-flash-lite"),
  ollamaUrl: z.string().url().default("http://localhost:11434"),
  ollamaModel: z.string().min(1).default("qwen2.5:3b-instruct"),
  /** 音声合成エンジン。 */
  selectedTts: z.enum(TTS_IDS).default("voicevox"),
  voicevoxUrl: z.string().url().default("http://localhost:50021"),
  voicevoxSpeaker: z.coerce.number().int().nonnegative().default(2),
  /** macOS say の voice 名。空文字でシステム既定。 */
  sayVoice: z.string().default(""),
  /** macOS say の発話速度 (words per minute)。 */
  sayRate: z.coerce.number().int().positive().default(180),
  // null = 全ソース有効（デフォルト）、配列 = 明示選択、[] = 全 OFF
  enabledSources: z.array(z.string()).nullable().default(null),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
