/** 既定の RSS フィード URL 一覧。新規プロファイルおよび設定未指定時の初期値。 */
export const DEFAULT_RSS_URLS: readonly string[] = [
  // 日本
  "https://www.nhk.or.jp/rss/news/cat0.xml",
  "https://www.nhk.or.jp/rss/news/cat1.xml",
  "https://www.nhk.or.jp/rss/news/cat2.xml",
  "https://www.nhk.or.jp/rss/news/cat3.xml",
  "https://www.nhk.or.jp/rss/news/cat5.xml",
  "https://www.nhk.or.jp/rss/news/cat6.xml",
  "https://www.nhk.or.jp/rss/news/cat7.xml",
  "https://www.publickey1.jp/atom.xml",
  "https://rss.itmedia.co.jp/rss/2.0/topstory.xml",
  "https://gigazine.net/news/rss_2.0/",
  "https://zenn.dev/feed",
  "https://b.hatena.ne.jp/hotentry.rss",
  "https://b.hatena.ne.jp/hotentry/it.rss",
  "https://b.hatena.ne.jp/hotentry/life.rss",
  "https://b.hatena.ne.jp/hotentry/social.rss",
  "https://b.hatena.ne.jp/hotentry/fun.rss",
  // グローバル（英語は LLM で和訳）
  "https://feeds.bbci.co.uk/japanese/rss.xml",
  "https://techcrunch.com/feed/",
  "https://www.theverge.com/rss/index.xml",
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://hnrss.org/frontpage",
];
