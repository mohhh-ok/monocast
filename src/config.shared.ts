import { z } from "zod";

export const LLM_IDS = ["anthropic", "openai", "gemini", "ollama"] as const;
export type LlmId = (typeof LLM_IDS)[number];

export const TTS_IDS = [
  "voicevox",
  "aivisspeech",
  "say",
  "openai",
  "elevenlabs",
  "piper",
] as const;
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
  /** AivisSpeech (VOICEVOX 互換)。デフォルトポートは 10101。 */
  aivisSpeechUrl: z.string().url().default("http://localhost:10101"),
  aivisSpeechSpeaker: z.coerce.number().int().nonnegative().default(888753760),
  /** macOS say の voice 名。空文字でシステム既定。 */
  sayVoice: z.string().default(""),
  /** macOS say の発話速度 (words per minute)。 */
  sayRate: z.coerce.number().int().positive().default(180),
  /** OpenAI TTS。 */
  openaiTtsModel: z.string().min(1).default("gpt-4o-mini-tts"),
  openaiTtsVoice: z.string().min(1).default("alloy"),
  /** ElevenLabs。voice ID は ElevenLabs ダッシュボードから取得。 */
  elevenlabsModelId: z.string().min(1).default("eleven_turbo_v2_5"),
  elevenlabsVoiceId: z.string().min(1).default("21m00Tcm4TlvDq8ikWAM"),
  /** Piper。PATH 通っていれば bin = "piper" でよい。 */
  piperBin: z.string().min(1).default("piper"),
  piperModelPath: z.string().default(""),
  piperSpeakerId: z.coerce.number().int().nonnegative().optional(),
  /** 段落ごとの音声合成を何並列で走らせるか (1 で逐次)。 */
  ttsConcurrency: z.coerce.number().int().min(1).max(8).default(1),
  // null = 全ソース有効（デフォルト）、配列 = 明示選択、[] = 全 OFF
  enabledSources: z.array(z.string()).nullable().default(null),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
