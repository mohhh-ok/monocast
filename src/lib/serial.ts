/**
 * load → mutate → save を直列化するためのキュー。
 * 同じインスタンスに渡した関数は前のものが解決するまで開始しない。
 * 失敗は呼び出し元に伝播するが、キュー自体は止めない。
 */
export type SerialQueue = <T>(fn: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };
}
