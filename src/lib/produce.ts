import { randomUUID } from "node:crypto";
import path from "node:path";
import { getConfig } from "@/config";
import type { LlmAdapter } from "./llm";
import { log } from "./log";
import { fetchNews } from "./news";
import { addProgram, removeProgram, updateProgram, type Program } from "./queue";
import { generateProgramScript } from "./script";
import { synthesizeToSegments } from "./tts";

const NEWS_ITEMS_PER_PROGRAM = 10;

export type ProduceResult =
  | { status: "ok"; program: Program }
  | { status: "empty"; reason: "no-sources" | "no-fresh" };

function profileScript(body: string) {
  const paragraphs = body
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const longestLen = paragraphs.reduce((m, p) => Math.max(m, p.length), 0);
  return {
    totalLen: body.length,
    paragraphs: paragraphs.length,
    longestLen,
    newlineCount: (body.match(/\n/g) ?? []).length,
  };
}

function describeErrorChain(err: unknown): { message: string; chain: string[]; stack?: string } {
  const chain: string[] = [];
  let cur: unknown = err;
  const seen = new Set<unknown>();
  let stack: string | undefined;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      const code = (cur as Error & { code?: string }).code;
      chain.push(code ? `${cur.message} [${code}]` : cur.message);
      if (!stack && cur.stack) stack = cur.stack;
      cur = (cur as Error & { cause?: unknown }).cause;
    } else {
      chain.push(String(cur));
      break;
    }
  }
  return { message: chain.join(" <- "), chain, stack };
}

/** ニュース取得 → 台本 → 音声 → キュー追加 をまとめて行う（1 adapter で 1 本） */
export async function produceProgram(
  adapter: LlmAdapter,
): Promise<ProduceResult> {
  const id = randomUUID();
  const shortId = id.slice(0, 8);
  const tag = `produce:${shortId}`;
  const t0 = Date.now();
  log.info(tag, `開始 LLM=${adapter.label} (${adapter.id}/${adapter.model})`);

  try {
    const cfg = await getConfig();
    const tNews = Date.now();
    const { items: news, candidateCount, seenCount } = await fetchNews(
      NEWS_ITEMS_PER_PROGRAM,
      cfg.enabledSources,
    );
    log.info(
      tag,
      `ニュース取得 ${news.length}件 (${Date.now() - tNews}ms)`,
    );
    if (news.length === 0) {
      if (candidateCount > 0 && seenCount >= candidateCount) {
        log.warn(
          tag,
          `新規ニュースなし: 候補 ${candidateCount}件すべて既出のため中止`,
        );
        return { status: "empty", reason: "no-fresh" };
      }
      log.warn(tag, "ニュースが0件のため中止");
      return { status: "empty", reason: "no-sources" };
    }

    const tScript = Date.now();
    log.info(tag, "台本生成中...");
    const script = await generateProgramScript(news, adapter);
    log.info(
      tag,
      `台本完了 「${script.title}」${script.body.length}字 (${Date.now() - tScript}ms)`,
    );
    log.debug(tag, "原稿プロファイル", profileScript(script.body));

    const outDir = path.join(process.cwd(), "public", "audio", id);
    const tTts = Date.now();
    log.info(tag, `音声合成開始 -> audio/${id}/`);

    const program: Program = {
      id,
      title: script.title,
      body: script.body,
      audioSegments: [],
      expectedSegmentCount: 0,
      durationSec: 0,
      createdAt: new Date().toISOString(),
      sources: script.sources,
      llm: {
        id: adapter.id,
        label: adapter.label,
        model: adapter.model,
      },
    };

    let enqueued = false;
    try {
      const { segments, totalDurationSec } = await synthesizeToSegments(
        script.body,
        outDir,
        `/audio/${id}`,
        {
          logTag: tag,
          onStart: async (total) => {
            program.expectedSegmentCount = total;
            await addProgram(program);
            enqueued = true;
            log.info(tag, `番組を仮 enqueue (段落数 ${total}, 合成は継続中)`);
          },
          onProgress: async (published) => {
            const dur = Math.max(
              1,
              Math.round(published.reduce((a, s) => a + s.durationSec, 0)),
            );
            await updateProgram(id, {
              audioSegments: published,
              durationSec: dur,
            });
          },
        },
      );
      log.info(
        tag,
        `音声完了 ${totalDurationSec}s seg=${segments.length} (${Date.now() - tTts}ms)`,
      );
      program.audioSegments = segments;
      program.durationSec = totalDurationSec;
    } catch (err) {
      if (enqueued) {
        await removeProgram(id).catch(() => {});
      }
      throw err;
    }

    const { markSeen } = await import("./news/seen");
    markSeen(script.sources.map((s) => s.link));
    log.info(tag, `番組追加完了 合計 ${Date.now() - t0}ms`);
    return { status: "ok", program };
  } catch (err) {
    const { message, chain, stack } = describeErrorChain(err);
    log.error(tag, `失敗: ${message}`, { chain, stack, elapsedMs: Date.now() - t0 });
    throw err;
  }
}
