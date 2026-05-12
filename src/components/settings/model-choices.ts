import type { LlmId, TtsId } from "@/config.shared";

export const LLM_LABELS: Record<LlmId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  ollama: "Ollama (ローカル)",
};

export const TTS_LABELS: Record<TtsId, string> = {
  voicevox: "VOICEVOX",
  aivisspeech: "AivisSpeech",
  say: "macOS say",
  sapi: "Windows SAPI",
  openai: "OpenAI TTS",
  elevenlabs: "ElevenLabs",
  kokoro: "Kokoro (Docker / 多言語)",
};

export const OPENAI_TTS_MODELS = [
  "gpt-4o-mini-tts",
  "tts-1",
  "tts-1-hd",
] as const;

export const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

export const ELEVENLABS_MODELS = [
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
] as const;

// 安い順に列挙（2026-05 時点・公式公開価格ベース）
export const ANTHROPIC_MODELS = [
  "claude-haiku-4-5", // $1 / $5 (cheapest current)
  "claude-sonnet-4-6", // $3 / $15
  "claude-opus-4-7", // $5 / $25
] as const;

export const OPENAI_MODELS = [
  "gpt-4.1-nano", // $0.10 / $0.40 (cheapest)
  "gpt-4o-mini", // $0.15 / $0.60
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o",
] as const;

export const GEMINI_MODELS = [
  "gemini-2.5-flash-lite", // $0.10 / $0.40 (cheapest)
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
] as const;

// ローカル実行（無料）。軽量・日本語要約向けを上から
export const OLLAMA_MODELS = [
  "qwen2.5:3b-instruct", // 軽量 + 日本語OK
  "qwen2.5:7b-instruct",
  "llama3.2:3b",
  "phi3:mini",
  "mistral:7b",
  "llama3.1:8b",
] as const;
