import { z } from "zod";
import { dataPath } from "../data-dir";
import { openSqliteOnce } from "../sqlite";
import { type NewsItem, NewsItemSchema } from "./adapters/types";

const PayloadSchema = z.array(NewsItemSchema);

const getDb = openSqliteOnce(() => dataPath("rss-cache.sqlite"), (db) => {
  db.prepare(
    "CREATE TABLE IF NOT EXISTS rss_cache (feed_id TEXT PRIMARY KEY, fetched_at INTEGER NOT NULL, payload TEXT NOT NULL)",
  ).run();
});

/** TTL 内であればキャッシュ済み NewsItem[] を返す。期限切れ・破損時は null。 */
export function getCached(feedId: string, maxAgeMs: number): NewsItem[] | null {
  const row = getDb()
    .prepare("SELECT fetched_at, payload FROM rss_cache WHERE feed_id = ?")
    .get(feedId) as { fetched_at: number; payload: string } | undefined;
  if (!row) return null;
  if (Date.now() - row.fetched_at > maxAgeMs) return null;
  const parsed = PayloadSchema.safeParse(JSON.parse(row.payload));
  return parsed.success ? parsed.data : null;
}

export function putCached(feedId: string, items: NewsItem[]): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO rss_cache (feed_id, fetched_at, payload) VALUES (?, ?, ?)",
    )
    .run(feedId, Date.now(), JSON.stringify(items));
}

/** 期限切れレコードを削除し、削除件数を返す。 */
export function purgeOlderThan(maxAgeMs: number): number {
  const cutoff = Date.now() - maxAgeMs;
  const r = getDb()
    .prepare("DELETE FROM rss_cache WHERE fetched_at < ?")
    .run(cutoff);
  return Number(r.changes ?? 0);
}
