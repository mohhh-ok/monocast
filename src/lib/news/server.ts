import { log } from "../log";
import { createRssAdapter } from "./adapters/rss/server";
import type { NewsItem } from "./adapters/types";

export type { NewsAdapter, NewsItem } from "./adapters/types";
export { DEFAULT_RSS_URLS } from "./defaults";

export type FetchNewsResult = {
  items: NewsItem[];
  /** 取得した候補件数。 */
  candidateCount: number;
  /** 候補のうち既出URL（過去14日）として除外された件数。 */
  seenCount: number;
};

/**
 * ニュースを取得する。
 * @param limit 返す総件数の上限
 * @param urls 取得対象の RSS URL 一覧。空配列なら空結果を返す。
 */
export async function fetchNews(
  limit: number,
  urls: readonly string[],
): Promise<FetchNewsResult> {
  if (urls.length === 0) return { items: [], candidateCount: 0, seenCount: 0 };

  const adapter = createRssAdapter({ name: "rss:default", urls: [...urls] });
  const items = await adapter.fetch(limit);

  // 過去14日に番組化済みのURLを除外（seen.ts は node:sqlite 依存なので動的 import）
  const { getSeenSet, purgeExpired } = await import("./seen");
  const purged = purgeExpired();
  if (purged > 0) log.info("news", `seen_urls TTL 削除 ${purged}件`);
  const links = items.map((it) => it.link).filter((l) => l.length > 0);
  const seenUrls = getSeenSet(links);
  const fresh = items.filter((it) => !seenUrls.has(it.link));
  if (seenUrls.size > 0)
    log.info("news", `既出URL除外 ${seenUrls.size}件 / 候補 ${items.length}件`);

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

  return {
    items: selected,
    candidateCount: items.length,
    seenCount: seenUrls.size,
  };
}
