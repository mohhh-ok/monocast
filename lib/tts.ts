import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const VOICEVOX_URL = process.env.VOICEVOX_URL || "http://localhost:50021";
const SPEAKER = Number(process.env.VOICEVOX_SPEAKER || "13"); // 13 = 青山龍星 ノーマル

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

async function synthOne(
  text: string,
  speaker: number,
  trailingSilenceSec: number,
): Promise<Buffer> {
  const qRes = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
    { method: "POST" },
  );
  if (!qRes.ok) {
    throw new Error(`VOICEVOX audio_query failed: ${qRes.status}`);
  }
  const query = await qRes.json();
  query.speedScale = 1.0;
  query.volumeScale = 1.0;
  // 話題の切り替わりに「間」を入れる
  if (trailingSilenceSec > 0) {
    query.postPhonemeLength = trailingSilenceSec;
  }

  const sRes = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/wav" },
    body: JSON.stringify(query),
  });
  if (!sRes.ok) {
    throw new Error(`VOICEVOX synthesis failed: ${sRes.status}`);
  }
  return Buffer.from(await sRes.arrayBuffer());
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

/**
 * 原稿テキストを VOICEVOX で合成し、mp3 ファイルとして outPath に保存する。
 * 戻り値は再生時間（秒、概算）。
 */
export async function synthesizeToMp3(
  scriptBody: string,
  outPath: string,
): Promise<{ durationSec: number }> {
  const paragraphs = splitParagraphs(scriptBody);
  if (paragraphs.length === 0) throw new Error("空の原稿です");

  const work = await fs.mkdtemp(path.join(tmpdir(), "airadio-"));
  try {
    const wavPaths: string[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const isLast = i === paragraphs.length - 1;
      const trailing = isLast ? 0 : 0.9; // 話題の間に約0.9秒の無音
      const wav = await synthOne(paragraphs[i], SPEAKER, trailing);
      const p = path.join(work, `seg-${String(i).padStart(3, "0")}.wav`);
      await fs.writeFile(p, wav);
      wavPaths.push(p);
    }

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
