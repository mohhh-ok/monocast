import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runProc } from "@/lib/proc";
import type { SynthesizeOptions, TtsAdapter } from "../types";
import { appendSilenceToWav } from "../../wav";

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
        await runProc("say", args);
        const wav = await fs.readFile(out);
        return appendSilenceToWav(wav, trailingSilenceSec, SAMPLE_RATE);
      } finally {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}
