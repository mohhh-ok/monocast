import { z } from "zod";

export const NewsItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  source: z.string(),
  pubDate: z.string().optional(),
  contentSnippet: z.string().optional(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export type NewsAdapter = {
  /** adapter 識別子。ログ・デバッグ用。 */
  readonly name: string;
  /** 1 adapter が返す件数の上限を渡して取得する。 */
  fetch(limit: number): Promise<NewsItem[]>;
};
