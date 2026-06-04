import { z } from "zod";
import { DEFAULT_RSS_URLS } from "./lib/news/defaults";

/** 仮想プロファイル ID。実体ファイルを持たず、選択中は番組生成のたびに既存プロファイルから 1 つランダムに使われる。 */
export const RANDOM_PROFILE_ID = "__random__";
export const RANDOM_PROFILE_NAME = "🎲 ランダム";

export const LLM_IDS = ["anthropic", "openai", "gemini", "ollama"] as const;
export type LlmId = (typeof LLM_IDS)[number];

export const TTS_IDS = [
  "voicevox",
  "aivisspeech",
  "say",
  "sapi",
  "openai",
  "elevenlabs",
  "kokoro",
] as const;
export type TtsId = (typeof TTS_IDS)[number];

export const DEDUP_MODES = ["strict", "soft"] as const;
export type DedupMode = (typeof DEDUP_MODES)[number];

export const ConfigSchema = z.object({
  /** 番組生成に使う LLM。 */
  selectedLlm: z.enum(LLM_IDS).default("ollama"),
  anthropicModel: z.string().min(1).default("claude-haiku-4-5"),
  openaiModel: z.string().min(1).default("gpt-4.1-nano"),
  geminiModel: z.string().min(1).default("gemini-2.5-flash-lite"),
  ollamaModel: z.string().min(1).default("qwen2.5:3b-instruct"),
  /** 音声合成エンジン。接続先 URL はプロファイルではなく環境変数 (src/lib/env.ts) で持つ。 */
  selectedTts: z.enum(TTS_IDS).default("voicevox"),
  voicevoxSpeaker: z.coerce.number().int().nonnegative().default(2),
  /** AivisSpeech (VOICEVOX 互換)。 */
  aivisSpeechSpeaker: z.coerce.number().int().nonnegative().default(888753760),
  /** macOS say の voice 名。空文字でシステム既定。 */
  sayVoice: z.string().default(""),
  /** macOS say の発話速度 (words per minute)。 */
  sayRate: z.coerce.number().int().positive().default(180),
  /** Windows SAPI の voice 名 (例: "Microsoft Haruka Desktop")。空文字でシステム既定。 */
  sapiVoice: z.string().default(""),
  /** Windows SAPI の発話速度。-10..10 の整数 (0 が標準)。 */
  sapiRate: z.coerce.number().int().min(-10).max(10).default(0),
  /** OpenAI TTS。 */
  openaiTtsModel: z.string().min(1).default("gpt-4o-mini-tts"),
  openaiTtsVoice: z.string().min(1).default("alloy"),
  /** ElevenLabs。voice ID は ElevenLabs ダッシュボードから取得。 */
  elevenlabsModelId: z.string().min(1).default("eleven_turbo_v2_5"),
  elevenlabsVoiceId: z.string().min(1).default("21m00Tcm4TlvDq8ikWAM"),
  /** Kokoro-FastAPI (Docker)。多言語対応。 */
  kokoroVoice: z.string().min(1).default("af_heart"),
  /** 段落ごとの音声合成を何並列で走らせるか (1 で逐次)。 */
  ttsConcurrency: z.coerce.number().int().min(1).max(8).default(1),
  /**
   * 番組原稿を生成する出力言語の BCP 47 風コード。
   * voice の locale 絞り込みと、LLM プロンプトに添える言語指示の両方で使う。
   */
  outputLanguageCode: z.string().min(2).max(16).default("ja"),
  /**
   * 言語に関する追加のニュアンス指示（例: 固有名詞は英語読みのまま、フォーマルに、関西弁で 等）。
   * 空文字なら添えない。LLM プロンプトにそのまま渡る。
   */
  outputLanguageNotes: z.string().max(500).default(""),
  /** 取得対象の RSS フィード URL 一覧。[] なら取得しない（次の番組は作られない）。 */
  rssUrls: z
    .array(z.string().url())
    .default(() => [...DEFAULT_RSS_URLS]),
  /**
   * 過去14日に番組化済みの URL の扱い:
   * - "soft": 除外せず、選定時の重みを下げる（既定。ランダム50 → 日付降順10 → ランク重み抽選）。
   * - "strict": 候補から完全に除外（新規が尽きれば番組生成は中止）。
   */
  dedupMode: z.enum(DEDUP_MODES).default("soft"),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
