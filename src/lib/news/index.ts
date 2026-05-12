import { createRssAdapter } from "./adapters/rss";
import type { NewsAdapter, NewsItem } from "./types";

export type { NewsAdapter, NewsItem } from "./types";

const adapters: NewsAdapter[] = [
  createRssAdapter({
    name: "rss:default",
    feeds: [
      // NHK
      { name: "NHK 主要", url: "https://www.nhk.or.jp/rss/news/cat0.xml" },
      { name: "NHK 社会", url: "https://www.nhk.or.jp/rss/news/cat1.xml" },
      { name: "NHK 文化", url: "https://www.nhk.or.jp/rss/news/cat2.xml" },
      { name: "NHK 科学医療", url: "https://www.nhk.or.jp/rss/news/cat3.xml" },
      { name: "NHK 経済", url: "https://www.nhk.or.jp/rss/news/cat5.xml" },
      { name: "NHK 国際", url: "https://www.nhk.or.jp/rss/news/cat6.xml" },
      { name: "NHK スポーツ", url: "https://www.nhk.or.jp/rss/news/cat7.xml" },
      // テック
      { name: "Publickey", url: "https://www.publickey1.jp/atom.xml" },
      { name: "ITmedia NEWS", url: "https://rss.itmedia.co.jp/rss/2.0/news.xml" },
      { name: "GIGAZINE", url: "https://gigazine.net/news/rss_2.0/" },
      { name: "Zenn", url: "https://zenn.dev/feed" },
      // 海外（日本語）
      { name: "BBC 日本語", url: "https://feeds.bbci.co.uk/japanese/rss.xml" },
      // 海外（英語）— LLM で和訳させる
      { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
      { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
      { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
      { name: "Hacker News", url: "https://hnrss.org/frontpage" },
      // はてブ
      { name: "はてブ 総合", url: "https://b.hatena.ne.jp/hotentry.rss" },
      { name: "はてブ Tech", url: "https://b.hatena.ne.jp/hotentry/it.rss" },
      { name: "はてブ 暮らし", url: "https://b.hatena.ne.jp/hotentry/life.rss" },
      { name: "はてブ 政治と経済", url: "https://b.hatena.ne.jp/hotentry/social.rss" },
      { name: "はてブ おもしろ", url: "https://b.hatena.ne.jp/hotentry/fun.rss" },
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
