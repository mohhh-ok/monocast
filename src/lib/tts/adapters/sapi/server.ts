import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runProc } from "@/lib/proc";
import type { SynthesizeOptions, TtsAdapter } from "../types";
import { appendSilenceToWav } from "../../wav";

export type SapiAdapterOptions = {
  name?: string;
  /** Windows SAPI のインストール済み voice 名 (例: "Microsoft Haruka Desktop")。未指定でシステム既定。 */
  voice?: string;
  /** SAPI の発話速度。-10..10 の整数。負で遅く、正で速く。 */
  rate?: number;
};

const SAMPLE_RATE = 24000;

export function createSapiAdapter(opts: SapiAdapterOptions = {}): TtsAdapter {
  const name = opts.name ?? "sapi";
  const voice = opts.voice;
  const rate = clampRate(opts.rate ?? 0);

  return {
    name,
    async synthesize(text: string, { trailingSilenceSec }: SynthesizeOptions): Promise<Buffer> {
      const dir = await fs.mkdtemp(path.join(tmpdir(), "sapi-"));
      const outPath = path.join(dir, "out.wav");
      const textPath = path.join(dir, "text.txt");
      const scriptPath = path.join(dir, "speak.ps1");
      try {
        // UTF-8 BOM を付けて PowerShell の ReadAllText で日本語を正しく読ませる。
        await fs.writeFile(textPath, `﻿${text}`, "utf8");
        await fs.writeFile(scriptPath, buildPs1({ outPath, textPath, voice, rate }), "utf8");
        await runProc("powershell.exe", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
        ]);
        const wav = await fs.readFile(outPath);
        return appendSilenceToWav(wav, trailingSilenceSec, SAMPLE_RATE);
      } finally {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}

function clampRate(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-10, Math.min(10, Math.round(n)));
}

/** PowerShell の single-quoted 文字列に埋めるためのエスケープ。 */
function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function buildPs1(params: {
  outPath: string;
  textPath: string;
  voice: string | undefined;
  rate: number;
}): string {
  const { outPath, textPath, voice, rate } = params;
  const selectVoice = voice ? `$s.SelectVoice(${psQuote(voice)})` : "";
  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Speech",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    selectVoice,
    `$s.Rate = ${rate}`,
    `$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${SAMPLE_RATE}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)`,
    `$s.SetOutputToWaveFile(${psQuote(outPath)}, $fmt)`,
    `$text = [System.IO.File]::ReadAllText(${psQuote(textPath)}, [System.Text.Encoding]::UTF8)`,
    "$s.Speak($text)",
    "$s.Dispose()",
    "",
  ].join("\r\n");
}
