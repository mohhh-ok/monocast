import Parser from "rss-parser";
import { log } from "../../log";
import type { NewsAdapter, NewsItem } from "../types";

export type RssAdapterOptions = {
  /** adapter 識別子。複数 RSS adapter を併存させる場合に区別する。 */
  name?: string;
  urls: string[];
  timeoutMs?: number;
  /** 1 フィードあたりの取得上限。 */
  perFeedLimit?: number;
  /** キャッシュ有効期間 (ms)。0 で無効化。 */
  cacheTtlMs?: number;
};

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

type ParsedFeed = {
  title?: string;
  items?: { title?: string; link?: string; pubDate?: string; contentSnippet?: string }[];
};

function deriveSourceName(feed: ParsedFeed, url: string): string {
  const t = (feed.title ?? "").trim();
  if (t) return t;
  return getDomain(url);
}

function toNewsItems(
  feed: ParsedFeed,
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
      const pending: string[] = [];
      for (const url of opts.urls) {
        const c = cache?.getCached(url, cacheTtlMs) ?? null;
        if (c) cachedItems.push(...c);
        else pending.push(url);
      }
      if (cache && cachedItems.length > 0) {
        log.info(
          name,
          `キャッシュヒット ${opts.urls.length - pending.length}/${opts.urls.length} フィード`,
        );
      }

      // 残りはドメイン単位で直列、ドメイン同士は並列
      const fetchedItems: NewsItem[] = [];
      if (pending.length > 0) {
        const byDomain = new Map<string, string[]>();
        for (const url of pending) {
          const d = getDomain(url);
          const arr = byDomain.get(d);
          if (arr) arr.push(url);
          else byDomain.set(d, [url]);
        }

        await Promise.all(
          Array.from(byDomain.values()).map(async (group) => {
            for (const url of group) {
              try {
                const feed = await parser.parseURL(url);
                const source = deriveSourceName(feed, url);
                const items = toNewsItems(feed, source, perFeedLimit);
                fetchedItems.push(...items);
                cache?.putCached(url, items);
              } catch (err) {
                log.warn(
                  name,
                  `フィード取得失敗 ${url}: ${err instanceof Error ? err.message : String(err)}`,
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
