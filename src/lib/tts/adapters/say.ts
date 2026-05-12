import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SynthesizeOptions, TtsAdapter } from "../types";

export type SayAdapterOptions = {
  name?: string;
  /** macOS say の voice 名。未指定でシステム既定。 */
  voice?: string;
  /** 発話速度 (words per minute)。 */
  rate?: number;
};

const SAMPLE_RATE = 24000;

export function createSayAdapter(opts: SayAdapterOptions = {}): TtsAdapter {
  const name = opts.name ?? "say";
  const { voice, rate } = opts;

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const dir = await fs.mkdtemp(path.join(tmpdir(), "say-"));
      const out = path.join(dir, "out.wav");
      try {
        const args: string[] = [];
        if (voice) args.push("-v", voice);
        if (rate && rate > 0) args.push("-r", String(rate));
        args.push(
          "--file-format=WAVE",
          `--data-format=LEI16@${SAMPLE_RATE}`,
          "-o",
          out,
          text,
        );
        await runSay(args);
        const wav = await fs.readFile(out);
        return appendSilenceToWav(wav, trailingSilenceSec, SAMPLE_RATE);
      } finally {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}

function runSay(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("say", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`say exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * 16bit mono LE PCM WAV の data チャンクに無音を追記する。
 * say は WAVE_FORMAT_PCM で吐くので、data チャンクサイズと RIFF サイズだけ書き換えれば済む。
 */
function appendSilenceToWav(wav: Buffer, silenceSec: number, sampleRate: number): Buffer {
  if (silenceSec <= 0) return wav;
  let i = 12;
  while (i < wav.length - 8) {
    const id = wav.toString("ascii", i, i + 4);
    const size = wav.readUInt32LE(i + 4);
    if (id === "data") {
      const silenceBytes = Math.round(silenceSec * sampleRate) * 2;
      const silence = Buffer.alloc(silenceBytes);
      const head = wav.subarray(0, i + 8);
      const data = wav.subarray(i + 8, i + 8 + size);
      const tail = wav.subarray(i + 8 + size);
      const out = Buffer.concat([head, data, silence, tail]);
      out.writeUInt32LE(size + silenceBytes, i + 4);
      const riffSize = wav.readUInt32LE(4);
      out.writeUInt32LE(riffSize + silenceBytes, 4);
      return out;
    }
    i += 8 + size + (size % 2);
  }
  throw new Error("WAV data chunk not found");
}
