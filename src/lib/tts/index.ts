import { promises as fs } from "node:fs";
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
import { readWavSampleRate } from "./wav";

export type { TtsAdapter, SynthesizeOptions } from "./types";

export type AudioSegment = {
  /** ブラウザから参照する URL（/audio/<id>/seg-NNN.wav） */
  url: string;
  /** その段落の概算再生秒数 */
  durationSec: number;
};

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

/** WAV ファイルの本体バイト数とサンプルレートから概算秒数を出す（16bit mono 前提） */
function estimateWavDurationSec(wav: Buffer): number {
  const sampleRate = readWavSampleRate(wav);
  const bytesPerSecond = sampleRate * 2;
  const dataBytes = Math.max(0, wav.length - 44);
  return dataBytes / bytesPerSecond;
}

export type SynthesizeStreamOptions = {
  logTag?: string;
  /** 段落分割が確定したタイミング（合成開始前）に総数を通知する。 */
  onStart?: (totalCount: number) => Promise<void> | void;
  /** インデックス順に「公開可能になった」セグメントのスナップショットを渡す。 */
  onProgress?: (publishedSegments: AudioSegment[]) => Promise<void> | void;
};

/**
 * 原稿テキストを TTS adapter で段落ごとに合成し、wav ファイルとして outDir に保存する。
 * 段落 0 が完成した瞬間から onProgress で順番に公開していくので、呼び出し側は
 * その時点で番組を再生可能にできる。
 */
export async function synthesizeToSegments(
  scriptBody: string,
  outDir: string,
  publicUrlBase: string,
  opts: SynthesizeStreamOptions = {},
): Promise<{ segments: AudioSegment[]; totalDurationSec: number }> {
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

  await fs.mkdir(outDir, { recursive: true });
  await opts.onStart?.(paragraphs.length);

  const segments: AudioSegment[] = new Array(paragraphs.length);
  // 完成順に届く buffer。nextPublishIdx から連続して埋まったぶんを onProgress に流す。
  const buffer: (AudioSegment | undefined)[] = new Array(paragraphs.length);
  const published: AudioSegment[] = [];
  let nextPublishIdx = 0;
  let publishChain: Promise<void> = Promise.resolve();
  let nextIndex = 0;
  let done = 0;

  const drain = async () => {
    let appended = false;
    while (buffer[nextPublishIdx]) {
      published.push(buffer[nextPublishIdx]!);
      nextPublishIdx++;
      appended = true;
    }
    if (appended && opts.onProgress) {
      await opts.onProgress(published.slice());
    }
  };

  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= paragraphs.length) return;
      // 最終段落は番組間のクッションとして 3 秒、それ以外は段落間の 0.9 秒。
      const isLast = i === paragraphs.length - 1;
      const trailingSilenceSec = isLast ? 3 : 0.9;
      const tSeg = Date.now();
      log.debug(tag, `段落 ${i + 1}/${paragraphs.length} 合成開始`, {
        index: i,
        total: paragraphs.length,
        len: paragraphs[i].length,
        head: paragraphs[i].slice(0, 40),
      });
      try {
        const wav = await adapter.synthesize(paragraphs[i], { trailingSilenceSec });
        const filename = `seg-${String(i).padStart(3, "0")}.wav`;
        await fs.writeFile(path.join(outDir, filename), wav);
        const seg: AudioSegment = {
          url: `${publicUrlBase}/${filename}`,
          durationSec: Math.max(0.1, estimateWavDurationSec(wav)),
        };
        segments[i] = seg;
        buffer[i] = seg;
        done++;
        log.info(
          tag,
          `  段落 ${i + 1}/${paragraphs.length} 合成 ${paragraphs[i].length}字 (${Date.now() - tSeg}ms) [${done}/${paragraphs.length}]`,
        );
        // インデックス順を保つため publishChain にチェーン
        publishChain = publishChain.then(drain);
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
  await publishChain; // 最後の drain を確実に流す

  const totalDurationSec = Math.max(
    1,
    Math.round(segments.reduce((a, s) => a + s.durationSec, 0)),
  );
  return { segments, totalDurationSec };
}
