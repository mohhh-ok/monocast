import { describe, expect, it } from "vitest";
import { languageHumanName, languageLabel, localeMatches, normalizeLocale } from "./lang";

describe("normalizeLocale", () => {
  it("アンダースコア区切りをハイフンに直し lang-REGION に正規化する", () => {
    expect(normalizeLocale("ja_JP")).toBe("ja-JP");
    expect(normalizeLocale("en_US")).toBe("en-US");
    expect(normalizeLocale("JA-jp")).toBe("ja-JP");
  });

  it("言語タグだけなら小文字化して返す", () => {
    expect(normalizeLocale("JA")).toBe("ja");
    expect(normalizeLocale("en")).toBe("en");
  });

  it("空文字は空文字のまま", () => {
    expect(normalizeLocale("")).toBe("");
  });
});

describe("localeMatches", () => {
  it("完全一致でマッチする", () => {
    expect(localeMatches("en-US", "en-US")).toBe(true);
    expect(localeMatches("en_US", "en-US")).toBe(true);
  });

  it("片方が言語タグだけなら言語一致でマッチする", () => {
    expect(localeMatches("ja-JP", "ja")).toBe(true);
    expect(localeMatches("en", "en-US")).toBe(true);
  });

  it("リージョン違いの完全指定同士はマッチしない", () => {
    expect(localeMatches("en-GB", "en-US")).toBe(false);
  });

  it("言語が違えばマッチしない", () => {
    expect(localeMatches("ja-JP", "en")).toBe(false);
  });

  it("code が空ならフィルタ無効で常に true", () => {
    expect(localeMatches("ja-JP", "")).toBe(true);
    expect(localeMatches("", "")).toBe(true);
  });

  it("code 指定ありで voiceLocale が空なら false", () => {
    expect(localeMatches("", "ja")).toBe(false);
  });
});

describe("languageLabel / languageHumanName", () => {
  it("既知のコードはラベル・人間可読名を返す", () => {
    expect(languageLabel("ja")).toBe("日本語 (ja)");
    expect(languageHumanName("en-US")).toBe("English (United States)");
  });

  it("未知のコードはコードをそのまま返す", () => {
    expect(languageLabel("xx-YY")).toBe("xx-YY");
    expect(languageHumanName("xx-YY")).toBe("xx-YY");
  });
});
