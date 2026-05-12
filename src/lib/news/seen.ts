import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DB_FILE = path.join(process.cwd(), "data", "seen.sqlite");
const TTL_DAYS = 14;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

let db: DatabaseSync | null = null;

function runDDL(d: DatabaseSync, sql: string): void {
  d.prepare(sql).run();
}

function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(path.dirname(DB_FILE), { recursive: true });
  db = new DatabaseSync(DB_FILE);
  runDDL(db, "PRAGMA journal_mode = WAL");
  runDDL(
    db,
    "CREATE TABLE IF NOT EXISTS seen_urls (url TEXT PRIMARY KEY, first_seen_at INTEGER NOT NULL)",
  );
  runDDL(
    db,
    "CREATE INDEX IF NOT EXISTS seen_urls_first_seen_at ON seen_urls(first_seen_at)",
  );
  return db;
}

/** TTL を超えたレコードを削除。 */
export function purgeExpired(): number {
  const cutoff = Date.now() - TTL_MS;
  const stmt = getDb().prepare("DELETE FROM seen_urls WHERE first_seen_at < ?");
  const r = stmt.run(cutoff);
  return Number(r.changes ?? 0);
}

/** 既出URLの集合を返す。 */
export function getSeenSet(urls: readonly string[]): Set<string> {
  if (urls.length === 0) return new Set();
  const placeholders = urls.map(() => "?").join(",");
  const stmt = getDb().prepare(
    `SELECT url FROM seen_urls WHERE url IN (${placeholders})`,
  );
  const rows = stmt.all(...urls) as { url: string }[];
  return new Set(rows.map((r) => r.url));
}

/** URL を既出として記録。重複は無視。 */
export function markSeen(urls: readonly string[]): void {
  const filtered = urls.filter((u) => u.length > 0);
  if (filtered.length === 0) return;
  const now = Date.now();
  const stmt = getDb().prepare(
    "INSERT OR IGNORE INTO seen_urls (url, first_seen_at) VALUES (?, ?)",
  );
  for (const url of filtered) stmt.run(url, now);
}
