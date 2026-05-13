import { log } from "@/lib/log";
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
  const tag = `tts:${name}`;

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const queryUrl = `${voicevoxUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;
      const tQuery = Date.now();
      log.debug(tag, "audio_query 開始", { url: voicevoxUrl, speaker, textLen: text.length });
      let qRes: Response;
      try {
        qRes = await fetch(queryUrl, { method: "POST" });
      } catch (err) {
        log.error(tag, "audio_query 接続失敗", {
          url: voicevoxUrl,
          phase: "audio_query",
          elapsedMs: Date.now() - tQuery,
          cause: err instanceof Error ? err.message : String(err),
        });
        throw new Error(`VOICEVOX audio_query 接続失敗 (${voicevoxUrl})`, { cause: err });
      }
      log.debug(tag, "audio_query 完了", {
        status: qRes.status,
        elapsedMs: Date.now() - tQuery,
      });
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
      const tSynth = Date.now();
      log.debug(tag, "synthesis 開始", { url: voicevoxUrl, speaker });
      let sRes: Response;
      try {
        sRes = await fetch(synthUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "audio/wav" },
          body: JSON.stringify(query),
        });
      } catch (err) {
        log.error(tag, "synthesis 接続失敗", {
          url: voicevoxUrl,
          phase: "synthesis",
          elapsedMs: Date.now() - tSynth,
          cause: err instanceof Error ? err.message : String(err),
        });
        throw new Error(`VOICEVOX synthesis 接続失敗 (${voicevoxUrl})`, { cause: err });
      }
      const buf = Buffer.from(await sRes.arrayBuffer());
      log.debug(tag, "synthesis 完了", {
        status: sRes.status,
        elapsedMs: Date.now() - tSynth,
        bytes: buf.length,
      });
      if (!sRes.ok) {
        throw new Error(`VOICEVOX synthesis failed: ${sRes.status} (${voicevoxUrl})`);
      }
      return buf;
    },
  };
}
