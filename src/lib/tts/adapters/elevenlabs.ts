import type { SynthesizeOptions, TtsAdapter } from "../types";
import { appendSilenceToWav, buildWavFromPcm } from "../wav";

export type ElevenLabsAdapterOptions = {
  name?: string;
  apiKey: string;
  /** `eleven_turbo_v2_5` / `eleven_multilingual_v2` 等 */
  modelId: string;
  /** ElevenLabs の voice ID (UI から確認 / API でも取得可) */
  voiceId: string;
};

const SAMPLE_RATE = 24000;

export function createElevenLabsAdapter(opts: ElevenLabsAdapterOptions): TtsAdapter {
  const name = opts.name ?? "elevenlabs";
  const { apiKey, modelId, voiceId } = opts;

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const url =
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}` +
        `?output_format=pcm_${SAMPLE_RATE}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/pcm",
        },
        body: JSON.stringify({ text, model_id: modelId }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `ElevenLabs TTS failed: ${res.status} ${body.slice(0, 200)}`,
        );
      }
      const pcm = Buffer.from(await res.arrayBuffer());
      const wav = buildWavFromPcm(pcm, SAMPLE_RATE);
      return appendSilenceToWav(wav, trailingSilenceSec, SAMPLE_RATE);
    },
  };
}
