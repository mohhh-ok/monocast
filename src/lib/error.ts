/**
 * Error の `cause` を辿り、メッセージ列・最初に見つかった stack をまとめて返す。
 * `chain` は呼び出し元から構造化ログに出すために残してある。
 */
export type FormattedError = {
  /** "outer <- inner <- root" 形式に連結したメッセージ。 */
  message: string;
  chain: string[];
  stack?: string;
};

export function formatErrorChain(err: unknown): FormattedError {
  const chain: string[] = [];
  const seen = new Set<unknown>();
  let stack: string | undefined;
  let cur: unknown = err;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      const code = (cur as Error & { code?: string }).code;
      chain.push(code ? `${cur.message} [${code}]` : cur.message);
      if (!stack && cur.stack) stack = cur.stack;
      cur = (cur as Error & { cause?: unknown }).cause;
    } else {
      chain.push(String(cur));
      break;
    }
  }
  return { message: chain.join(" <- "), chain, stack };
}
