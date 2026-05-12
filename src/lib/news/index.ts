import { log } from "../log";
import { createRssAdapter, type RssFeed } from "./adapters/rss";
import { CATEGORY_ORDER, type NewsItem, type SourceCategory } from "./types";

export type { NewsAdapter, NewsItem, SourceCategory, SourceOption } from "./types";
export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SOURCE_CATEGORIES,
  SourceCategorySchema,
  SourceOptionSchema,
} from "./types";
export type { RssFeed } from "./adapters/rss";

export const SOURCES: readonly RssFeed[] = [
  // 日本
  { id: "nhk-cat0", name: "NHK 主要", url: "https://www.nhk.or.jp/rss/news/cat0.xml", category: "japan" },
  { id: "nhk-cat1", name: "NHK 社会", url: "https://www.nhk.or.jp/rss/news/cat1.xml", category: "japan" },
  { id: "nhk-cat2", name: "NHK 文化", url: "https://www.nhk.or.jp/rss/news/cat2.xml", category: "japan" },
  { id: "nhk-cat3", name: "NHK 科学医療", url: "https://www.nhk.or.jp/rss/news/cat3.xml", category: "japan" },
  { id: "nhk-cat5", name: "NHK 経済", url: "https://www.nhk.or.jp/rss/news/cat5.xml", category: "japan" },
  { id: "nhk-cat6", name: "NHK 国際", url: "https://www.nhk.or.jp/rss/news/cat6.xml", category: "japan" },
  { id: "nhk-cat7", name: "NHK スポーツ", url: "https://www.nhk.or.jp/rss/news/cat7.xml", category: "japan" },
  { id: "publickey", name: "Publickey", url: "https://www.publickey1.jp/atom.xml", category: "japan" },
  { id: "itmedia", name: "ITmedia NEWS", url: "https://rss.itmedia.co.jp/rss/2.0/news.xml", category: "japan" },
  { id: "gigazine", name: "GIGAZINE", url: "https://gigazine.net/news/rss_2.0/", category: "japan" },
  { id: "zenn", name: "Zenn", url: "https://zenn.dev/feed", category: "japan" },
  { id: "hatena-all", name: "はてブ 総合", url: "https://b.hatena.ne.jp/hotentry.rss", category: "japan" },
  { id: "hatena-it", name: "はてブ Tech", url: "https://b.hatena.ne.jp/hotentry/it.rss", category: "japan" },
  { id: "hatena-life", name: "はてブ 暮らし", url: "https://b.hatena.ne.jp/hotentry/life.rss", category: "japan" },
  { id: "hatena-social", name: "はてブ 政治と経済", url: "https://b.hatena.ne.jp/hotentry/social.rss", category: "japan" },
  { id: "hatena-fun", name: "はてブ おもしろ", url: "https://b.hatena.ne.jp/hotentry/fun.rss", category: "japan" },
  // グローバル（英語 — LLM で和訳。BBC 日本語版は UK 発のため global 扱い）
  { id: "bbc-ja", name: "BBC 日本語", url: "https://feeds.bbci.co.uk/japanese/rss.xml", category: "global" },
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "global" },
  { id: "theverge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "global" },
  { id: "bbc", name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "global" },
  { id: "hackernews", name: "Hacker News", url: "https://hnrss.org/frontpage", category: "global" },
];

export function listSources(): readonly RssFeed[] {
  return SOURCES;
}

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
 * @param enabledIds 有効ソース ID。null なら全件、空配列なら空結果を返す。
 */
export async function fetchNews(
  limit: number,
  enabledIds: readonly string[] | null,
): Promise<FetchNewsResult> {
  if (enabledIds !== null && enabledIds.length === 0)
    return { items: [], candidateCount: 0, seenCount: 0 };

  const feeds =
    enabledIds === null
      ? [...SOURCES]
      : SOURCES.filter((s) => enabledIds.includes(s.id));

  if (feeds.length === 0) return { items: [], candidateCount: 0, seenCount: 0 };

  const adapter = createRssAdapter({ name: "rss:default", feeds });
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

  // カテゴリ→ソース別のバケットに振り分け、カテゴリ間で均等クォータ＋
  // カテゴリ内ソース間ラウンドロビンで選出する。フィード本数が多いカテゴリに
  // 結果が支配されるのを防ぐ。
  const nameToCategory = new Map<string, SourceCategory>();
  for (const f of feeds) nameToCategory.set(f.name, f.category);
  const buckets = new Map<SourceCategory, Map<string, NewsItem[]>>();
  for (const it of fresh) {
    const cat = nameToCategory.get(it.source);
    if (!cat) continue;
    let catMap = buckets.get(cat);
    if (!catMap) {
      catMap = new Map();
      buckets.set(cat, catMap);
    }
    const arr = catMap.get(it.source);
    if (arr) arr.push(it);
    else catMap.set(it.source, [it]);
  }

  const activeCategories = CATEGORY_ORDER.filter((c) => buckets.has(c));
  if (activeCategories.length === 0)
    return { items: [], candidateCount: items.length, seenCount: seenUrls.size };

  const base = Math.floor(limit / activeCategories.length);
  const remainder = limit % activeCategories.length;
  const quotas = new Map<SourceCategory, number>();
  activeCategories.forEach((c, i) => {
    quotas.set(c, base + (i < remainder ? 1 : 0));
  });

  const selected: NewsItem[] = [];
  const leftovers: NewsItem[][] = [];
  for (const cat of activeCategories) {
    const sources = Array.from(buckets.get(cat)!.values());
    const quota = quotas.get(cat) ?? 0;
    let taken = 0;
    while (taken < quota) {
      let progressed = false;
      for (const arr of sources) {
        if (arr.length === 0) continue;
        const item = arr.shift();
        if (!item) continue;
        selected.push(item);
        taken += 1;
        progressed = true;
        if (taken >= quota) break;
      }
      if (!progressed) break;
    }
    const rest: NewsItem[] = [];
    for (const arr of sources) rest.push(...arr);
    if (rest.length > 0) leftovers.push(rest);
  }

  // クォータが他カテゴリの不足で埋まらなかった分を、残り在庫からラウンドロビンで補充
  while (selected.length < limit && leftovers.some((a) => a.length > 0)) {
    let progressed = false;
    for (const arr of leftovers) {
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
