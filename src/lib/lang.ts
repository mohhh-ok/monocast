/**
 * 番組生成の出力言語を表すコード（BCP 47 風）と、その表示ラベル。
 * TTS voice の locale を絞り込むキーとしても使うので、ここで一元管理する。
 */

export type LanguageCode =
  | "ja"
  | "en-US"
  | "en-GB"
  | "en"
  | "zh"
  | "ko"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt-BR"
  | "hi";

export type LanguageOption = {
  code: LanguageCode;
  label: string;
};

/** UI のプルダウンに並べる順。日本語を先頭、英語系を次に。 */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "ja", label: "日本語 (ja)" },
  { code: "en-US", label: "English – US (en-US)" },
  { code: "en-GB", label: "English – UK (en-GB)" },
  { code: "en", label: "English (en)" },
  { code: "zh", label: "中文 (zh)" },
  { code: "ko", label: "한국어 (ko)" },
  { code: "es", label: "Español (es)" },
  { code: "fr", label: "Français (fr)" },
  { code: "de", label: "Deutsch (de)" },
  { code: "it", label: "Italiano (it)" },
  { code: "pt-BR", label: "Português – BR (pt-BR)" },
  { code: "hi", label: "हिन्दी (hi)" },
];

const LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  LANGUAGE_OPTIONS.map((o) => [o.code, o.label]),
);

/** LLM への指示に差し込む人間可読な言語名（"日本語", "English" 等）。 */
const HUMAN_NAME: Record<string, string> = {
  ja: "日本語",
  "en-US": "English (United States)",
  "en-GB": "English (United Kingdom)",
  en: "English",
  zh: "中文",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  "pt-BR": "Português (Brasil)",
  hi: "हिन्दी",
};

export function languageLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}

export function languageHumanName(code: string): string {
  return HUMAN_NAME[code] ?? code;
}

/**
 * voice の locale 表記を BCP 47 風に正規化する。
 * 例: "ja_JP" → "ja-JP", "en_US" → "en-US", "JA-jp" → "ja-JP"。
 * 言語タグだけの "ja" や "en" もそのまま小文字化して返す。
 */
export function normalizeLocale(raw: string): string {
  if (!raw) return "";
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 0) return "";
  const lang = parts[0].toLowerCase();
  if (parts.length === 1) return lang;
  const region = parts[1].toUpperCase();
  return `${lang}-${region}`;
}

/**
 * voice の locale が、希望する言語コードにマッチするか判定する。
 * 完全一致を最優先 (en-US == en-US)、なければ言語タグの前方一致 (en-US ~ en) を許す。
 * `code` が空文字なら常に true（フィルタ無効）。
 */
export function localeMatches(voiceLocale: string, code: string): boolean {
  if (!code) return true;
  const v = normalizeLocale(voiceLocale);
  const c = normalizeLocale(code);
  if (!v) return false;
  if (v === c) return true;
  // 言語タグ一致 (ja-JP と ja、en-US と en)
  const vLang = v.split("-")[0];
  const cLang = c.split("-")[0];
  if (vLang !== cLang) return false;
  // 片方が言語タグだけ、もう片方がリージョン付き → 言語一致でマッチ
  if (!v.includes("-") || !c.includes("-")) return true;
  return false;
}
