import { createRssAdapter } from "./adapters/rss";
import type { NewsAdapter, NewsItem } from "./types";

export type { NewsAdapter, NewsItem } from "./types";

const adapters: NewsAdapter[] = [
  createRssAdapter({
    name: "rss:default",
    feeds: [
      { name: "NHK 主要", url: "https://www.nhk.or.jp/rss/news/cat0.xml" },
      { name: "NHK 社会", url: "https://www.nhk.or.jp/rss/news/cat1.xml" },
      { name: "NHK 国際", url: "https://www.nhk.or.jp/rss/news/cat6.xml" },
      { name: "はてブ Tech", url: "https://b.hatena.ne.jp/hotentry/it.rss" },
    ],
  }),
];

export async function fetchNews(limit = 6): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    adapters.map((a) => a.fetch(limit)),
  );

  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }

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
