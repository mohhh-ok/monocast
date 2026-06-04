/**
 * monocast headless CLI player.
 *
 * ブラウザ（src/routes/index.tsx）の司令塔ループを Node で置き換えたもの。
 *   - producer: キューが MIN_QUEUE 未満なら produceProgram で1本作って貯める
 *   - player:   完成済みの最古番組を afplay でセグメント順に鳴らし、終わったら削除して次へ
 * 生成と再生を1プロセス内で並行に回すので、番組間はほぼ途切れない。
 *
 * 実行: pnpm play   （内部で vite-node を使い vite の `@/` エイリアスを解決する）
 * 対象プラットフォーム: macOS（afplay 前提）
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { withResolvedActiveProfile } from "@/config";
import { dataPath } from "@/lib/data-dir";
import { pickAdapter } from "@/lib/llm/server";
import { produceProgram, ProduceAbortedError } from "@/lib/produce";
import { listPrograms, removeProgram } from "@/lib/queue";
import type { Program } from "@/lib/queue.types";
import { log } from "@/lib/log";

const TAG = "play";
const MIN_QUEUE = 2;

// .env を process.env に流し込む（getEnv は process.env を読む）。Node 22+ の API。
function loadEnvFiles(): void {
  for (const f of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(path.join(process.cwd(), f));
    } catch {
      // ファイルが無ければ無視
    }
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let stopped = false;
let producing = false;
let currentChild: ChildProcess | null = null;
let skipRequested = false;
// 進行中の produceProgram。終了時に abort して中途半端な番組（孤児）を残さない。
let produceController: AbortController | null = null;

function isComplete(p: Program): boolean {
  return p.expectedSegmentCount > 0 && p.audioSegments.length >= p.expectedSegmentCount;
}

function segFile(id: string, index: number): string {
  return dataPath("audio", id, `seg-${String(index).padStart(3, "0")}.wav`);
}

/**
 * 起動時クリーンアップ。合成途中でプロセスが落ちて残った未完成番組は
 * produceProgram では再開されず永久に埋まらないので、ここで破棄する。
 *
 * 判定は「合成が始まった（expectedSegmentCount > 0）のに完了していない」ものに限定する。
 * expectedSegmentCount === 0 は addProgram 直前の一瞬しか存在しないが、`pnpm dev` 併用や
 * play 多重起動で他プロセスが生成中の番組を巻き込まないよう、対象から外す。
 */
async function cleanOrphans(): Promise<void> {
  const programs = await listPrograms();
  for (const p of programs) {
    if (p.expectedSegmentCount > 0 && p.audioSegments.length < p.expectedSegmentCount) {
      log.info(
        TAG,
        `孤児番組を破棄 ${p.title} (${p.audioSegments.length}/${p.expectedSegmentCount}) ${p.id.slice(0, 8)}`,
      );
      await removeProgram(p.id);
    }
  }
}

async function producerTick(): Promise<void> {
  if (producing || stopped) return;
  const programs = await listPrograms();
  if (programs.length >= MIN_QUEUE) return;
  producing = true;
  const controller = new AbortController();
  produceController = controller;
  try {
    await withResolvedActiveProfile(async () => {
      const adapter = await pickAdapter();
      log.info(TAG, `生成開始 (LLM=${adapter.label})`);
      const r = await produceProgram(adapter, { signal: controller.signal });
      if (r.status === "empty") {
        const why = r.reason === "no-fresh" ? "新規ニュースなし" : "ニュースソース未選択";
        log.warn(TAG, `生成スキップ: ${why}`);
        // ニュース枯渇/未設定で即リトライしても無駄なので少し待たせる
        await sleep(30_000);
      } else {
        log.info(TAG, `生成完了: ${r.program.title}`);
      }
    });
  } catch (err) {
    if (!(err instanceof ProduceAbortedError)) {
      log.error(TAG, `生成エラー: ${err instanceof Error ? err.message : String(err)}`, {
        stack: err instanceof Error ? err.stack : undefined,
      });
      await sleep(10_000);
    }
  } finally {
    if (produceController === controller) produceController = null;
    producing = false;
  }
}

async function producerLoop(): Promise<void> {
  while (!stopped) {
    await producerTick();
    await sleep(1500);
  }
}

function playFile(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("afplay", [file], { stdio: "ignore" });
    currentChild = child;
    child.on("error", reject);
    child.on("close", () => {
      currentChild = null;
      resolve();
    });
  });
}

// ANSI カラー。TTY でないとき（リダイレクト等）は制御コードを混ぜない。
const useColor = process.stdout.isTTY;
const paint = (code: string, text: string): string =>
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
const c = {
  title: (t: string) => paint("1;36", t), // 太字シアン
  source: (t: string) => paint("33", t), // 黄
  snippet: (t: string) => paint("2", t), // 薄字
  url: (t: string) => paint("4;34", t), // 下線つき青
};

async function playProgram(p: Program): Promise<void> {
  console.log(`\n♪ ${c.title(p.title)}`);
  for (const s of p.sources) {
    console.log(`   ・${c.source(`[${s.source}]`)} ${s.title}`);
    if (s.contentSnippet) console.log(`     ${c.snippet(s.contentSnippet)}`);
    console.log(`     ${c.url(s.link)}`);
  }
  skipRequested = false;
  for (let i = 0; i < p.expectedSegmentCount; i++) {
    if (stopped || skipRequested) break;
    const file = segFile(p.id, i);
    try {
      await fs.access(file);
    } catch {
      // isComplete を満たしたのにファイルが無い＝データ不整合。握り潰さず記録して次へ。
      log.error(TAG, `セグメント欠落 ${p.id.slice(0, 8)} ${path.basename(file)}`);
      continue;
    }
    process.stdout.write(`   ▸ ${i + 1}/${p.expectedSegmentCount}\r`);
    try {
      await playFile(file);
    } catch (err) {
      process.stdout.write("\n");
      log.error(TAG, `再生失敗 seg ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  process.stdout.write("\n");
}

async function playerLoop(): Promise<void> {
  while (!stopped) {
    const programs = await listPrograms();
    const current = programs.find(isComplete);
    if (!current) {
      // まだ完成番組がない（初回生成待ち）
      await sleep(1000);
      continue;
    }
    await playProgram(current);
    if (stopped) break;
    await removeProgram(current.id);
  }
}

function setupControls(): void {
  const stdin = process.stdin;
  if (!stdin.isTTY) return;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  stdin.on("data", (key: string) => {
    if (key === "n") {
      skipRequested = true;
      currentChild?.kill(); // 現セグメントを止めて番組を打ち切る
      console.log("\n⏭  スキップ");
    } else if (key === "q" || key === "\u0003") {
      // q または Ctrl+C
      shutdown();
    }
  });
}

function shutdown(): void {
  if (stopped) return;
  stopped = true;
  currentChild?.kill();
  // 進行中の合成を中断。produceProgram 側が enqueue 済みの番組を removeProgram するので
  // 中途半端な孤児を残さずに済む。
  produceController?.abort("shutdown");
  console.log("\n👋 終了します");
  // ループの sleep を待たずに落とす
  setTimeout(() => process.exit(0), 100);
}

async function main(): Promise<void> {
  loadEnvFiles();
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setupControls();

  console.log("📻 monocast headless — n: スキップ  q: 終了");
  await cleanOrphans();

  await Promise.all([producerLoop(), playerLoop()]);
}

main().catch((err) => {
  log.error(TAG, `致命的エラー: ${err instanceof Error ? err.message : String(err)}`, {
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
