import type { DedupMode } from "../../config.shared";
import { log } from "../log";
import { createRssAdapter } from "./adapters/rss/server";
import type { NewsItem } from "./adapters/types";

export type { NewsAdapter, NewsItem } from "./adapters/types";
export { DEFAULT_RSS_URLS } from "./defaults";

export type FetchNewsResult = {
  items: NewsItem[];
  /** 取得した候補件数。 */
  candidateCount: number;
  /** 候補のうち既出URL（過去14日）に該当した件数。strict なら全件除外、soft なら除外せず重み低下。 */
  seenCount: number;
};

export type FetchNewsOptions = {
  /** 既定は "strict"。"soft" は重み付き選定で既出も拾い得る。 */
  dedupMode?: DedupMode;
};

// soft モードの定数
const SOFT_POOL_SIZE = 50;       // ランダムにサンプリングする中間プール
const SOFT_RECENT_SIZE = 10;     // 日付降順で残す件数
const SOFT_HALF_RANK = 3;        // 指数減衰の半減ランク
const SOFT_SEEN_PENALTY = 0.15;  // 既出URLの重み係数

/**
 * ニュースを取得する。
 * @param limit 返す総件数の上限
 * @param urls 取得対象の RSS URL 一覧。空配列なら空結果を返す。
 */
export async function fetchNews(
  limit: number,
  urls: readonly string[],
  opts: FetchNewsOptions = {},
): Promise<FetchNewsResult> {
  if (urls.length === 0) return { items: [], candidateCount: 0, seenCount: 0 };

  const adapter = createRssAdapter({ name: "rss:default", urls: [...urls] });
  const items = await adapter.fetch(limit);

  // 過去14日に番組化済みのURLを参照（seen.ts は node:sqlite 依存なので動的 import）
  const { getSeenSet, purgeExpired } = await import("./seen");
  const purged = purgeExpired();
  if (purged > 0) log.info("news", `seen_urls TTL 削除 ${purged}件`);
  const links = items.map((it) => it.link).filter((l) => l.length > 0);
  const seenUrls = getSeenSet(links);

  const mode = opts.dedupMode ?? "strict";
  const selected =
    mode === "soft"
      ? selectSoft(items, seenUrls, limit)
      : selectStrict(items, seenUrls, limit);

  return {
    items: selected,
    candidateCount: items.length,
    seenCount: seenUrls.size,
  };
}

/** 既出URLを完全に除外し、ソース別ラウンドロビンで limit 件選ぶ。 */
function selectStrict(
  items: NewsItem[],
  seenUrls: ReadonlySet<string>,
  limit: number,
): NewsItem[] {
  const fresh = items.filter((it) => !seenUrls.has(it.link));
  if (seenUrls.size > 0)
    log.info(
      "news",
      `[strict] 既出URL除外 ${seenUrls.size}件 / 候補 ${items.length}件`,
    );

  // ソース別バケットにまとめ、各ソースからラウンドロビンで 1 件ずつ取って選出する。
  // フィード本数が多いソースに結果が支配されないようにしている。
  const bySource = new Map<string, NewsItem[]>();
  for (const it of fresh) {
    const arr = bySource.get(it.source);
    if (arr) arr.push(it);
    else bySource.set(it.source, [it]);
  }
  const sources = Array.from(bySource.values());

  const selected: NewsItem[] = [];
  while (selected.length < limit) {
    let progressed = false;
    for (const arr of sources) {
      if (arr.length === 0) continue;
      const item = arr.shift();
      if (!item) continue;
      selected.push(item);
      progressed = true;
      if (selected.length >= limit) break;
    }
    if (!progressed) break;
  }
  return selected;
}

/**
 * soft モード: 既出も含めて選定するが重みを下げる。
 *   1. 全候補から最大 SOFT_POOL_SIZE 件をランダムにサンプリング
 *   2. pubDate 降順で SOFT_RECENT_SIZE 件に絞る
 *   3. ランク重み (0.5 ** (rank/SOFT_HALF_RANK)) × 既出ペナルティ で非復元重み付き抽選を limit 回
 */
function selectSoft(
  items: NewsItem[],
  seenUrls: ReadonlySet<string>,
  limit: number,
): NewsItem[] {
  if (items.length === 0) return [];

  // 1. ランダムサンプリング（Fisher-Yates 部分シャッフル）
  const pool = items.slice();
  const poolSize = Math.min(SOFT_POOL_SIZE, pool.length);
  for (let i = 0; i < poolSize; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const sampled = pool.slice(0, poolSize);

  // 2. 日付降順で SOFT_RECENT_SIZE 件
  const recent = sampled
    .map((it) => ({ it, ts: parsePubDate(it.pubDate) }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, SOFT_RECENT_SIZE)
    .map((x) => x.it);

  // 3. ランク重み × 既出ペナルティで非復元抽選
  const remaining = recent.slice();
  const weights = recent.map((it, rank) => {
    const rankWeight = Math.pow(0.5, rank / SOFT_HALF_RANK);
    const penalty = seenUrls.has(it.link) ? SOFT_SEEN_PENALTY : 1;
    return rankWeight * penalty;
  });

  const selected: NewsItem[] = [];
  while (selected.length < limit && remaining.length > 0) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    let pick = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    selected.push(remaining[pick]);
    remaining.splice(pick, 1);
    weights.splice(pick, 1);
  }

  const seenInSelected = selected.filter((it) => seenUrls.has(it.link)).length;
  log.info(
    "news",
    `[soft] 候補 ${items.length} → サンプル ${sampled.length} → 上位 ${recent.length} → 選定 ${selected.length}件 (既出含む ${seenInSelected})`,
  );
  return selected;
}

function parsePubDate(s: string | undefined): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}
