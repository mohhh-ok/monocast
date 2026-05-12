import type { TtsAdapter } from "../types";
import { createVoicevoxAdapter } from "./voicevox";

export type AivisSpeechAdapterOptions = {
  url: string;
  speaker: number;
};

/**
 * AivisSpeech は VOICEVOX 互換 HTTP API (デフォルトポート 10101) を提供するので、
 * VOICEVOX adapter をそのまま流用する。
 */
export function createAivisSpeechAdapter(opts: AivisSpeechAdapterOptions): TtsAdapter {
  return createVoicevoxAdapter({
    name: "aivisspeech",
    voicevoxUrl: opts.url,
    speaker: opts.speaker,
  });
}
