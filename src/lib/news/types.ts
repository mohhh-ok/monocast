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

export const SOURCE_CATEGORIES = ["japanese", "tech", "overseas", "hatena"] as const;
export const SourceCategorySchema = z.enum(SOURCE_CATEGORIES);
export type SourceCategory = z.infer<typeof SourceCategorySchema>;

export const CATEGORY_LABELS: Record<SourceCategory, string> = {
  japanese: "日本語ニュース",
  tech: "テック",
  overseas: "海外",
  hatena: "はてブ",
};

export const CATEGORY_ORDER: readonly SourceCategory[] = [
  "japanese",
  "tech",
  "overseas",
  "hatena",
];

export const SourceOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: SourceCategorySchema,
});
export type SourceOption = z.infer<typeof SourceOptionSchema>;
