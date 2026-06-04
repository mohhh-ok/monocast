import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * 指定ファイルに対する DatabaseSync を 1 回だけ開き、以降は使い回す。
 * 親ディレクトリ作成、WAL モード設定、初回のスキーマ作成までを面倒みる。
 * パスは最初に開く瞬間に resolveFile() で解決する（モジュールロード時に
 * 固定すると MONOCAST_DATA_DIR による差し替えが効かなくなるため）。
 */
export function openSqliteOnce(
  resolveFile: () => string,
  init: (db: DatabaseSync) => void,
): () => DatabaseSync {
  let db: DatabaseSync | null = null;
  return () => {
    if (db) return db;
    const file = resolveFile();
    mkdirSync(path.dirname(file), { recursive: true });
    const opened = new DatabaseSync(file);
    opened.prepare("PRAGMA journal_mode = WAL").run();
    init(opened);
    db = opened;
    return db;
  };
}
