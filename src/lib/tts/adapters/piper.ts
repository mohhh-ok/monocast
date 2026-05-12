import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runProc } from "../../proc";
import type { SynthesizeOptions, TtsAdapter } from "../types";
import { appendSilenceToWav, readWavSampleRate } from "../wav";

export type PiperAdapterOptions = {
  name?: string;
  /** piper のバイナリパス。PATH 通っていれば "piper" でよい。 */
  bin: string;
  /** voice model (.onnx) のパス。`piper --model` に渡される。 */
  modelPath: string;
  /** multi-speaker model の場合に話者 ID を指定。 */
  speakerId?: number;
};

export function createPiperAdapter(opts: PiperAdapterOptions): TtsAdapter {
  const name = opts.name ?? "piper";
  const { bin, modelPath, speakerId } = opts;

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const dir = await fs.mkdtemp(path.join(tmpdir(), "piper-"));
      const out = path.join(dir, "out.wav");
      try {
        const args = ["--model", modelPath, "--output_file", out];
        if (speakerId !== undefined) args.push("--speaker", String(speakerId));
        await runProc(bin, args, { stdin: text });
        const wav = await fs.readFile(out);
        const sampleRate = readWavSampleRate(wav);
        return appendSilenceToWav(wav, trailingSilenceSec, sampleRate);
      } finally {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}
