import type { SynthesizeOptions, TtsAdapter } from "../types";

export type VoicevoxAdapterOptions = {
  /** adapter 識別子。複数 VOICEVOX を併存させる場合に区別する。 */
  name?: string;
  voicevoxUrl: string;
  speaker: number;
};

export function createVoicevoxAdapter(opts: VoicevoxAdapterOptions): TtsAdapter {
  const name = opts.name ?? "voicevox";
  const { voicevoxUrl, speaker } = opts;

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const queryUrl = `${voicevoxUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;
      let qRes: Response;
      try {
        qRes = await fetch(queryUrl, { method: "POST" });
      } catch (err) {
        throw new Error(`VOICEVOX audio_query 接続失敗 (${voicevoxUrl})`, { cause: err });
      }
      if (!qRes.ok) {
        throw new Error(`VOICEVOX audio_query failed: ${qRes.status} (${voicevoxUrl})`);
      }
      const query = await qRes.json();
      query.speedScale = 1.0;
      query.volumeScale = 1.0;
      if (trailingSilenceSec > 0) {
        query.postPhonemeLength = trailingSilenceSec;
      }

      const synthUrl = `${voicevoxUrl}/synthesis?speaker=${speaker}`;
      let sRes: Response;
      try {
        sRes = await fetch(synthUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "audio/wav" },
          body: JSON.stringify(query),
        });
      } catch (err) {
        throw new Error(`VOICEVOX synthesis 接続失敗 (${voicevoxUrl})`, { cause: err });
      }
      if (!sRes.ok) {
        throw new Error(`VOICEVOX synthesis failed: ${sRes.status} (${voicevoxUrl})`);
      }
      return Buffer.from(await sRes.arrayBuffer());
    },
  };
}
