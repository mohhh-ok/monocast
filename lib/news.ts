import Parser from "rss-parser";

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate?: string;
  contentSnippet?: string;
};

const FEEDS: { name: string; url: string }[] = [
  { name: "NHK 主要", url: "https://www.nhk.or.jp/rss/news/cat0.xml" },
  { name: "NHK 社会", url: "https://www.nhk.or.jp/rss/news/cat1.xml" },
  { name: "NHK 国際", url: "https://www.nhk.or.jp/rss/news/cat6.xml" },
  { name: "はてブ Tech", url: "https://b.hatena.ne.jp/hotentry/it.rss" },
];

const parser = new Parser({ timeout: 8000 });

export async function fetchNews(limit = 6): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      return (feed.items || []).slice(0, 5).map((it) => ({
        title: (it.title || "").trim(),
        link: it.link || "",
        source: f.name,
        pubDate: it.pubDate,
        contentSnippet: (it.contentSnippet || "").slice(0, 240),
      }));
    }),
  );

  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }

  // 重複タイトル除去 + 新しめを先頭にして混ぜる
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
