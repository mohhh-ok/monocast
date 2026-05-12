import Parser from "rss-parser";
import type { NewsAdapter, NewsItem, SourceCategory } from "../types";

export type RssFeed = {
  /** 設定保存に使う安定 ID。 */
  id: string;
  /** ソース表示名。NewsItem.source に入る。 */
  name: string;
  url: string;
  category: SourceCategory;
};

export type RssAdapterOptions = {
  /** adapter 識別子。複数 RSS adapter を併存させる場合に区別する。 */
  name?: string;
  feeds: RssFeed[];
  timeoutMs?: number;
  /** 1 フィードあたりの取得上限。 */
  perFeedLimit?: number;
};

export function createRssAdapter(opts: RssAdapterOptions): NewsAdapter {
  const parser = new Parser({ timeout: opts.timeoutMs ?? 8000 });
  const perFeedLimit = opts.perFeedLimit ?? 10;
  const name = opts.name ?? "rss";

  return {
    name,
    async fetch(_limit: number): Promise<NewsItem[]> {
      const results = await Promise.allSettled(
        opts.feeds.map(async (f) => {
          const feed = await parser.parseURL(f.url);
          return (feed.items || []).slice(0, perFeedLimit).map((it) => ({
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
      return items;
    },
  };
}
