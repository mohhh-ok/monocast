import { log } from "../../log";
import type { SynthesizeOptions, TtsAdapter } from "../types";
import { appendSilenceToWav, readWavSampleRate } from "../wav";

/**
 * Kokoro-FastAPI (https://github.com/remsky/Kokoro-FastAPI) を HTTP で叩く adapter。
 * OpenAI 互換の /v1/audio/speech にリクエストし WAV を受け取る。
 * 日本語 voice (jf_alpha 等) も Docker イメージ側で misaki[ja] が動いているので利用可能。
 */
export type KokoroAdapterOptions = {
  name?: string;
  /** Kokoro-FastAPI の base URL。既定ポートは 8880。 */
  url: string;
  /** voice 名。例: af_heart (en) / jf_alpha (ja) / zf_xiaobei (zh)。 */
  voice: string;
  /** 発話速度。1.0 = 通常。 */
  speed?: number;
};

export function createKokoroAdapter(opts: KokoroAdapterOptions): TtsAdapter {
  const name = opts.name ?? "kokoro";
  const { url, voice, speed } = opts;
  const tag = `tts:${name}`;

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const endpoint = `${url}/v1/audio/speech`;
      const tReq = Date.now();
      log.debug(tag, "speech 開始", { url, voice, textLen: text.length });
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "audio/wav" },
          body: JSON.stringify({
            model: "kokoro",
            input: text,
            voice,
            response_format: "wav",
            speed: speed ?? 1.0,
          }),
        });
      } catch (err) {
        log.error(tag, "speech 接続失敗", {
          url,
          elapsedMs: Date.now() - tReq,
          cause: err instanceof Error ? err.message : String(err),
        });
        throw new Error(`Kokoro-FastAPI 接続失敗 (${url})`, { cause: err });
      }
      const buf = Buffer.from(await res.arrayBuffer());
      log.debug(tag, "speech 完了", {
        status: res.status,
        elapsedMs: Date.now() - tReq,
        bytes: buf.length,
      });
      if (!res.ok) {
        throw new Error(
          `Kokoro-FastAPI speech failed: ${res.status} (${url}) ${buf.toString("utf8").slice(0, 200)}`,
        );
      }
      const sampleRate = readWavSampleRate(buf);
      return appendSilenceToWav(buf, trailingSilenceSec, sampleRate);
    },
  };
}
