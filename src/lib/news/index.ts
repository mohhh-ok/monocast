import { log } from "../log";
import { createRssAdapter, type RssFeed } from "./adapters/rss";
import { getSeenSet, purgeExpired } from "./seen";
import type { NewsItem } from "./types";

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
  // NHK
  { id: "nhk-cat0", name: "NHK 主要", url: "https://www.nhk.or.jp/rss/news/cat0.xml", category: "japanese" },
  { id: "nhk-cat1", name: "NHK 社会", url: "https://www.nhk.or.jp/rss/news/cat1.xml", category: "japanese" },
  { id: "nhk-cat2", name: "NHK 文化", url: "https://www.nhk.or.jp/rss/news/cat2.xml", category: "japanese" },
  { id: "nhk-cat3", name: "NHK 科学医療", url: "https://www.nhk.or.jp/rss/news/cat3.xml", category: "japanese" },
  { id: "nhk-cat5", name: "NHK 経済", url: "https://www.nhk.or.jp/rss/news/cat5.xml", category: "japanese" },
  { id: "nhk-cat6", name: "NHK 国際", url: "https://www.nhk.or.jp/rss/news/cat6.xml", category: "japanese" },
  { id: "nhk-cat7", name: "NHK スポーツ", url: "https://www.nhk.or.jp/rss/news/cat7.xml", category: "japanese" },
  { id: "bbc-ja", name: "BBC 日本語", url: "https://feeds.bbci.co.uk/japanese/rss.xml", category: "japanese" },
  // テック
  { id: "publickey", name: "Publickey", url: "https://www.publickey1.jp/atom.xml", category: "tech" },
  { id: "itmedia", name: "ITmedia NEWS", url: "https://rss.itmedia.co.jp/rss/2.0/news.xml", category: "tech" },
  { id: "gigazine", name: "GIGAZINE", url: "https://gigazine.net/news/rss_2.0/", category: "tech" },
  { id: "zenn", name: "Zenn", url: "https://zenn.dev/feed", category: "tech" },
  // 海外（英語 — LLM で和訳）
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "overseas" },
  { id: "theverge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "overseas" },
  { id: "bbc", name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "overseas" },
  { id: "hackernews", name: "Hacker News", url: "https://hnrss.org/frontpage", category: "overseas" },
  // はてブ
  { id: "hatena-all", name: "はてブ 総合", url: "https://b.hatena.ne.jp/hotentry.rss", category: "hatena" },
  { id: "hatena-it", name: "はてブ Tech", url: "https://b.hatena.ne.jp/hotentry/it.rss", category: "hatena" },
  { id: "hatena-life", name: "はてブ 暮らし", url: "https://b.hatena.ne.jp/hotentry/life.rss", category: "hatena" },
  { id: "hatena-social", name: "はてブ 政治と経済", url: "https://b.hatena.ne.jp/hotentry/social.rss", category: "hatena" },
  { id: "hatena-fun", name: "はてブ おもしろ", url: "https://b.hatena.ne.jp/hotentry/fun.rss", category: "hatena" },
];

export function listSources(): readonly RssFeed[] {
  return SOURCES;
}

/**
 * ニュースを取得する。
 * @param limit 返す総件数の上限
 * @param enabledIds 有効ソース ID。null なら全件、空配列なら空結果を返す。
 */
export async function fetchNews(
  limit = 6,
  enabledIds: readonly string[] | null = null,
): Promise<NewsItem[]> {
  if (enabledIds !== null && enabledIds.length === 0) return [];

  const feeds =
    enabledIds === null
      ? [...SOURCES]
      : SOURCES.filter((s) => enabledIds.includes(s.id));

  if (feeds.length === 0) return [];

  const adapter = createRssAdapter({ name: "rss:default", feeds });
  const items = await adapter.fetch(limit);

  // 重複タイトル除去
  const seenTitles = new Set<string>();
  const dedup = items.filter((it) => {
    const key = it.title;
    if (!key || seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  // 過去30日に番組化済みのURLを除外
  const purged = purgeExpired();
  if (purged > 0) log.info("news", `seen_urls TTL 削除 ${purged}件`);
  const links = dedup.map((it) => it.link).filter((l) => l.length > 0);
  const seenUrls = getSeenSet(links);
  const fresh = dedup.filter((it) => !seenUrls.has(it.link));
  if (seenUrls.size > 0)
    log.info("news", `既出URL除外 ${seenUrls.size}件 / 候補 ${dedup.length}件`);

  // 軽くシャッフルして多様性を出す（決定的すぎないように）
  fresh.sort(() => Math.random() - 0.5);
  return fresh.slice(0, limit);
}
