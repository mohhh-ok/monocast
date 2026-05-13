import type { SynthesizeOptions, TtsAdapter } from "../types";
import { appendSilenceToWav } from "../../wav";

export type OpenAiTtsAdapterOptions = {
  name?: string;
  apiKey: string;
  /** `gpt-4o-mini-tts` / `tts-1` / `tts-1-hd` 等 */
  model: string;
  /** `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`, `coral`, `verse`, `ballad`, `ash`, `sage` */
  voice: string;
  /** 既定 24kHz。OpenAI TTS の wav 出力は 24kHz mono 16bit。 */
  sampleRate?: number;
};

const DEFAULT_SAMPLE_RATE = 24000;

export function createOpenAiTtsAdapter(opts: OpenAiTtsAdapterOptions): TtsAdapter {
  const name = opts.name ?? "openai";
  const { apiKey, model, voice } = opts;
  const sampleRate = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: "wav",
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI TTS failed: ${res.status} ${body.slice(0, 200)}`);
      }
      const wav = Buffer.from(await res.arrayBuffer());
      return appendSilenceToWav(wav, trailingSilenceSec, sampleRate);
    },
  };
}
