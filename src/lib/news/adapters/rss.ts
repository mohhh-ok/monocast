import Parser from "rss-parser";
import { log } from "../../log";
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
  /** キャッシュ有効期間 (ms)。0 で無効化。 */
  cacheTtlMs?: number;
};

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function toNewsItems(
  feed: { items?: { title?: string; link?: string; pubDate?: string; contentSnippet?: string }[] },
  source: string,
  perFeedLimit: number,
): NewsItem[] {
  return (feed.items || []).slice(0, perFeedLimit).map((it) => ({
    title: (it.title || "").trim(),
    link: it.link || "",
    source,
    pubDate: it.pubDate,
    contentSnippet: (it.contentSnippet || "").slice(0, 240),
  }));
}

export function createRssAdapter(opts: RssAdapterOptions): NewsAdapter {
  const parser = new Parser({ timeout: opts.timeoutMs ?? 8000 });
  const perFeedLimit = opts.perFeedLimit ?? 30;
  const cacheTtlMs = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const name = opts.name ?? "rss";

  return {
    name,
    async fetch(_limit: number): Promise<NewsItem[]> {
      // node:sqlite を含むので動的 import（クライアントバンドル混入防止）
      const cache = cacheTtlMs > 0 ? await import("../cache") : null;

      const cachedItems: NewsItem[] = [];
      const pending: RssFeed[] = [];
      for (const f of opts.feeds) {
        const c = cache?.getCached(f.id, cacheTtlMs) ?? null;
        if (c) cachedItems.push(...c);
        else pending.push(f);
      }
      if (cache && cachedItems.length > 0) {
        log.info(
          name,
          `キャッシュヒット ${opts.feeds.length - pending.length}/${opts.feeds.length} フィード`,
        );
      }

      // 残りはドメイン単位で直列、ドメイン同士は並列
      const fetchedItems: NewsItem[] = [];
      if (pending.length > 0) {
        const byDomain = new Map<string, RssFeed[]>();
        for (const f of pending) {
          const d = getDomain(f.url);
          const arr = byDomain.get(d);
          if (arr) arr.push(f);
          else byDomain.set(d, [f]);
        }

        await Promise.all(
          Array.from(byDomain.values()).map(async (group) => {
            for (const f of group) {
              try {
                const feed = await parser.parseURL(f.url);
                const items = toNewsItems(feed, f.name, perFeedLimit);
                fetchedItems.push(...items);
                cache?.putCached(f.id, items);
              } catch (err) {
                log.warn(
                  name,
                  `フィード取得失敗 ${f.id}: ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            }
          }),
        );
      }

      return [...cachedItems, ...fetchedItems];
    },
  };
}
