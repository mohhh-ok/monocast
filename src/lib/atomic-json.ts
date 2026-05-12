import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * JSON を tmp ファイルに書いてから rename で差し替える。
 * 同一 FS 上の rename は POSIX でアトミックなので、読み手が部分書き込み中の
 * JSON を見ることがない。親ディレクトリは必要に応じて作成する。
 */
export async function atomicWriteJson(
  file: string,
  value: unknown,
  indent = 2,
): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, indent));
  await fs.rename(tmp, file);
}
