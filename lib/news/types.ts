export type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate?: string;
  contentSnippet?: string;
};

export type NewsAdapter = {
  /** adapter 識別子。ログ・デバッグ用。 */
  readonly name: string;
  /** 1 adapter が返す件数の上限を渡して取得する。 */
  fetch(limit: number): Promise<NewsItem[]>;
};
