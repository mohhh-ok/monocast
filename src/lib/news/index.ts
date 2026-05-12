import { createRssAdapter, type RssFeed } from "./adapters/rss";
import type { NewsItem } from "./types";

export type { NewsAdapter, NewsItem, SourceCategory } from "./types";
export { CATEGORY_LABELS, CATEGORY_ORDER } from "./types";
export type { RssFeed } from "./adapters/rss";

export const SOURCES: readonly RssFeed[] = [
  // NHK
  { id: "nhk-cat0", name: "NHK 主要", url: "https://www.nhk.or.jp/rss/news/cat0.xml", category: "domestic" },
  { id: "nhk-cat1", name: "NHK 社会", url: "https://www.nhk.or.jp/rss/news/cat1.xml", category: "domestic" },
  { id: "nhk-cat2", name: "NHK 文化", url: "https://www.nhk.or.jp/rss/news/cat2.xml", category: "domestic" },
  { id: "nhk-cat3", name: "NHK 科学医療", url: "https://www.nhk.or.jp/rss/news/cat3.xml", category: "domestic" },
  { id: "nhk-cat5", name: "NHK 経済", url: "https://www.nhk.or.jp/rss/news/cat5.xml", category: "domestic" },
  { id: "nhk-cat6", name: "NHK 国際", url: "https://www.nhk.or.jp/rss/news/cat6.xml", category: "domestic" },
  { id: "nhk-cat7", name: "NHK スポーツ", url: "https://www.nhk.or.jp/rss/news/cat7.xml", category: "domestic" },
  { id: "bbc-ja", name: "BBC 日本語", url: "https://feeds.bbci.co.uk/japanese/rss.xml", category: "domestic" },
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
  const seen = new Set<string>();
  const dedup = items.filter((it) => {
    const key = it.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 軽くシャッフルして多様性を出す（決定的すぎないように）
  dedup.sort(() => Math.random() - 0.5);
  return dedup.slice(0, limit);
}
