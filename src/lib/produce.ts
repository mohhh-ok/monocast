import { randomUUID } from "node:crypto";
import path from "node:path";
import { getConfig } from "@/config";
import type { LlmAdapter } from "./llm";
import { log } from "./log";
import { fetchNews } from "./news";
import { markSeen } from "./news/seen";
import { addProgram, type Program } from "./queue";
import { generateProgramScript } from "./script";
import { synthesizeToMp3 } from "./tts";

export type ProduceResult =
  | { status: "ok"; program: Program }
  | { status: "empty" };

/** ニュース取得 → 台本 → 音声 → キュー追加 をまとめて行う（1 adapter で 1 本） */
export async function produceProgram(
  adapter: LlmAdapter,
): Promise<ProduceResult> {
  const id = randomUUID();
  const shortId = id.slice(0, 8);
  const tag = `produce:${shortId}`;
  const t0 = Date.now();
  log.info(tag, `開始 LLM=${adapter.label} (${adapter.id}/${adapter.model})`);

  const cfg = await getConfig();
  const tNews = Date.now();
  const news = await fetchNews(10, cfg.enabledSources);
  log.info(
    tag,
    `ニュース取得 ${news.length}件 (${Date.now() - tNews}ms)`,
  );
  if (news.length === 0) {
    log.warn(tag, "ニュースが0件のため中止");
    return { status: "empty" };
  }

  const tScript = Date.now();
  log.info(tag, "台本生成中...");
  const script = await generateProgramScript(news, adapter);
  log.info(
    tag,
    `台本完了 「${script.title}」${script.body.length}字 (${Date.now() - tScript}ms)`,
  );

  const filename = `${id}.mp3`;
  const outPath = path.join(process.cwd(), "public", "audio", filename);
  const tTts = Date.now();
  log.info(tag, `音声合成開始 -> ${filename}`);
  const { durationSec } = await synthesizeToMp3(script.body, outPath, {
    logTag: tag,
  });
  log.info(
    tag,
    `音声完了 ${durationSec}s (${Date.now() - tTts}ms)`,
  );

  const program: Program = {
    id,
    title: script.title,
    body: script.body,
    audioUrl: `/audio/${filename}`,
    durationSec,
    createdAt: new Date().toISOString(),
    sources: script.sources,
    llm: {
      id: adapter.id,
      label: adapter.label,
      model: adapter.model,
    },
  };
  await addProgram(program);
  markSeen(script.sources.map((s) => s.link));
  log.info(tag, `番組追加完了 合計 ${Date.now() - t0}ms`);
  return { status: "ok", program };
}
