import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getConfig } from "@/config";
import { getEnv } from "@/lib/env";
import { createAivisSpeechAdapter } from "./adapters/aivisspeech";
import { createElevenLabsAdapter } from "./adapters/elevenlabs";
import { createOpenAiTtsAdapter } from "./adapters/openai";
import { createPiperAdapter } from "./adapters/piper";
import { createSayAdapter } from "./adapters/say";
import { createVoicevoxAdapter } from "./adapters/voicevox";
import { log } from "../log";
import type { TtsAdapter } from "./types";

export type { TtsAdapter, SynthesizeOptions } from "./types";

/** 原稿を段落単位に分割（短すぎる行は前と結合） */
function splitParagraphs(text: string): string[] {
  const raw = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of raw) {
    if (out.length > 0 && p.length < 12) {
      out[out.length - 1] += p;
    } else {
      out.push(p);
    }
  }
  return out;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function pickAdapter(cfg: Awaited<ReturnType<typeof getConfig>>): Promise<TtsAdapter> {
  switch (cfg.selectedTts) {
    case "say":
      return createSayAdapter({
        voice: cfg.sayVoice || undefined,
        rate: cfg.sayRate,
      });
    case "voicevox":
      return createVoicevoxAdapter({
        voicevoxUrl: cfg.voicevoxUrl,
        speaker: cfg.voicevoxSpeaker,
      });
    case "aivisspeech":
      return createAivisSpeechAdapter({
        url: cfg.aivisSpeechUrl,
        speaker: cfg.aivisSpeechSpeaker,
      });
    case "openai": {
      const env = getEnv();
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY が設定されていません");
      }
      return createOpenAiTtsAdapter({
        apiKey: env.OPENAI_API_KEY,
        model: cfg.openaiTtsModel,
        voice: cfg.openaiTtsVoice,
      });
    }
    case "elevenlabs": {
      const env = getEnv();
      if (!env.ELEVENLABS_API_KEY) {
        throw new Error("ELEVENLABS_API_KEY が設定されていません");
      }
      return createElevenLabsAdapter({
        apiKey: env.ELEVENLABS_API_KEY,
        modelId: cfg.elevenlabsModelId,
        voiceId: cfg.elevenlabsVoiceId,
      });
    }
    case "piper":
      if (!cfg.piperModelPath) {
        throw new Error("Piper の voice model パス (piperModelPath) が未設定です");
      }
      return createPiperAdapter({
        bin: cfg.piperBin,
        modelPath: cfg.piperModelPath,
        speakerId: cfg.piperSpeakerId,
      });
  }
}

/**
 * 原稿テキストを TTS adapter で合成し、mp3 ファイルとして outPath に保存する。
 * 戻り値は再生時間（秒、概算）。
 */
export async function synthesizeToMp3(
  scriptBody: string,
  outPath: string,
  opts: { logTag?: string } = {},
): Promise<{ durationSec: number }> {
  const tag = opts.logTag ?? "tts";
  const paragraphs = splitParagraphs(scriptBody);
  if (paragraphs.length === 0) throw new Error("空の原稿です");

  const cfg = await getConfig();
  const adapter = await pickAdapter(cfg);
  const concurrency = Math.max(1, Math.min(cfg.ttsConcurrency, paragraphs.length));
  log.info(
    tag,
    `TTS=${adapter.name} 段落数=${paragraphs.length} 並列=${concurrency}`,
  );
  const work = await fs.mkdtemp(path.join(tmpdir(), "airadio-"));
  try {
    const wavPaths: string[] = new Array(paragraphs.length);
    let nextIndex = 0;
    let done = 0;
    const worker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= paragraphs.length) return;
        const trailingSilenceSec = 0.9;
        const tSeg = Date.now();
        log.debug(tag, `段落 ${i + 1}/${paragraphs.length} 合成開始`, {
          index: i,
          total: paragraphs.length,
          len: paragraphs[i].length,
          head: paragraphs[i].slice(0, 40),
        });
        try {
          const wav = await adapter.synthesize(paragraphs[i], { trailingSilenceSec });
          const p = path.join(work, `seg-${String(i).padStart(3, "0")}.wav`);
          await fs.writeFile(p, wav);
          wavPaths[i] = p;
          done++;
          log.info(
            tag,
            `  段落 ${i + 1}/${paragraphs.length} 合成 ${paragraphs[i].length}字 (${Date.now() - tSeg}ms) [${done}/${paragraphs.length}]`,
          );
        } catch (err) {
          log.error(tag, `段落 ${i + 1}/${paragraphs.length} 合成失敗`, {
            index: i,
            total: paragraphs.length,
            len: paragraphs[i].length,
            head: paragraphs[i].slice(0, 80),
            elapsedMs: Date.now() - tSeg,
          });
          throw err;
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    log.info(tag, "ffmpeg で結合中...");

    const listPath = path.join(work, "list.txt");
    await fs.writeFile(
      listPath,
      wavPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    );

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "96k",
      "-ar",
      "44100",
      outPath,
    ]);

    // wav のサンプル数を雑に合算して秒数推定（44.1kHz 16bit mono の前提に近い）
    const stats = await Promise.all(wavPaths.map((p) => fs.stat(p)));
    const totalBytes = stats.reduce((a, b) => a + b.size, 0);
    const durationSec = Math.max(1, Math.round(totalBytes / (24000 * 2)));

    return { durationSec };
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
