import { rssCommon } from "./adapters/rss/common";
import type { NewsCommon } from "./adapters/types";

export type NewsId = "rss";

export const NEWS_COMMON: Record<NewsId, NewsCommon> = {
  rss: rssCommon,
};
