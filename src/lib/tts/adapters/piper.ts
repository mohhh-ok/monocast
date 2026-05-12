import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
        await runPiper(bin, args, text);
        const wav = await fs.readFile(out);
        const sampleRate = readWavSampleRate(wav);
        return appendSilenceToWav(wav, trailingSilenceSec, sampleRate);
      } finally {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}

function runPiper(bin: string, args: string[], text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`piper exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.stdin.write(text);
    proc.stdin.end();
  });
}
