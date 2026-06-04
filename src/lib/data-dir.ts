import path from "node:path";

/**
 * data ディレクトリ配下のパスを解決する。
 * 通常は <cwd>/data。環境変数 MONOCAST_DATA_DIR が設定されていれば
 * そちらを基点にする（テストが一時ディレクトリへ差し替えるための注入口）。
 *
 * モジュールロード時の const に固定すると、import 順によっては実データの
 * パスを掴んだままテストが走る事故につながるため、必ず呼び出し時に解決する。
 */
export function dataPath(...segments: string[]): string {
  const base =
    process.env.MONOCAST_DATA_DIR || path.join(process.cwd(), "data");
  return path.join(base, ...segments);
}
