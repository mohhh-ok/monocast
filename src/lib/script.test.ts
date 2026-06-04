import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { LlmAdapter, LlmGenerateInput } from "./llm/adapters/types";
import type { NewsItem } from "./news/adapters/types";
import { generateProgramScript } from "./script";

// プロンプトは JST の時間帯スロットで変わるので、時刻を昼（12:00 JST）に固定する。
// タイマー（setTimeout 等）は偽装せず Date だけ偽装する。
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-04T12:00:00+09:00"));
});

afterAll(() => {
  vi.useRealTimers();
});

/** generate() が固定値を返すフェイク adapter。受け取った入力も記録する。 */
function fakeAdapter(response: unknown) {
  const calls: LlmGenerateInput[] = [];
  const adapter: LlmAdapter = {
    id: "ollama",
    label: "Fake",
    model: "fake-model",
    async generate(input) {
      calls.push(input);
      // 異常系（title/body 欠落）を試すため any 経由で返す
      return response as never;
    },
  };
  return { adapter, calls };
}

const items: NewsItem[] = [
  {
    title: "記事A",
    link: "https://example.com/a",
    source: "Source A",
    contentSnippet: "Aの概要",
  },
  {
    title: "記事B",
    link: "https://example.com/b",
    source: "Source B",
  },
];

describe("generateProgramScript", () => {
  it("title と body を trim して返し、sources に素材を写す", async () => {
    const { adapter } = fakeAdapter({ title: " 今日の話題 ", body: "  本文です。\n二段落目。  " });
    const result = await generateProgramScript(items, adapter);
    expect(result.title).toBe("今日の話題");
    expect(result.body).toBe("本文です。\n二段落目。");
    expect(result.sources).toEqual([
      {
        title: "記事A",
        link: "https://example.com/a",
        source: "Source A",
        contentSnippet: "Aの概要",
      },
      {
        title: "記事B",
        link: "https://example.com/b",
        source: "Source B",
        contentSnippet: undefined,
      },
    ]);
  });

  it("title が空のときは 'Monocast' にフォールバックする", async () => {
    const { adapter } = fakeAdapter({ title: "", body: "本文" });
    const result = await generateProgramScript(items, adapter);
    expect(result.title).toBe("Monocast");
  });

  it("title が文字列でないときも 'Monocast' にフォールバックする", async () => {
    const { adapter } = fakeAdapter({ title: 123, body: "本文" });
    const result = await generateProgramScript(items, adapter);
    expect(result.title).toBe("Monocast");
  });

  it("body が欠けているときは adapter 情報付きで throw する", async () => {
    const { adapter } = fakeAdapter({ title: "タイトルのみ" });
    await expect(generateProgramScript(items, adapter)).rejects.toThrow(
      /body が含まれていません.*ollama\/fake-model/,
    );
  });

  it("body が空白のみのときも throw する", async () => {
    const { adapter } = fakeAdapter({ title: "t", body: "   \n  " });
    await expect(generateProgramScript(items, adapter)).rejects.toThrow(
      /body が含まれていません/,
    );
  });

  it("body が文字列でないときも throw する", async () => {
    const { adapter } = fakeAdapter({ title: "t", body: { nested: true } });
    await expect(generateProgramScript(items, adapter)).rejects.toThrow(
      /body が含まれていません/,
    );
  });

  it("userPrompt に全素材（タイトル・概要・件数）と時間帯が含まれる", async () => {
    const { adapter, calls } = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, adapter);
    expect(calls).toHaveLength(1);
    const prompt = calls[0].userPrompt;
    expect(prompt).toContain("2 件のニュース項目");
    expect(prompt).toContain("1. [Source A] 記事A");
    expect(prompt).toContain("Aの概要");
    expect(prompt).toContain("2. [Source B] 記事B");
    expect(prompt).toContain("（概要なし）");
    // 12:00 JST に固定しているので時間帯スロットは「昼」
    expect(prompt).toContain("配信時間帯: 昼");
  });

  // プロンプトの散文は頻繁にチューニングされるため、文中の文言には固定しない。
  // 分岐の検証は「言語ごとに何が変わるか」の構造的な差分・安定マーカーで行う。
  it("languageCode で system prompt が切り替わり、非日本語では対象言語が明記される", async () => {
    const ja = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, ja.adapter);
    const en = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, en.adapter, { languageCode: "en-US" });

    expect(ja.calls[0].systemPrompt).not.toBe(en.calls[0].systemPrompt);
    // 非日本語: 対象言語名とコードが system prompt に埋め込まれる（データ由来で安定）
    expect(en.calls[0].systemPrompt).toContain("English (United States)");
    expect(en.calls[0].systemPrompt).toContain("en-US");
    // 日本語側に英語向けの言語指定は現れない
    expect(ja.calls[0].systemPrompt).not.toContain("en-US");
  });

  it("日本語では出力例が付き、言語ヘッダーは付かない。非日本語はその逆", async () => {
    const ja = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, ja.adapter);
    const en = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, en.adapter, { languageCode: "en-US" });

    // 「出力例」「[OUTPUT LANGUAGE — STRICT]」は構造を示すラベルなので固定してよい
    expect(ja.calls[0].userPrompt).toContain("出力例");
    expect(ja.calls[0].userPrompt).not.toContain("[OUTPUT LANGUAGE — STRICT]");
    expect(en.calls[0].userPrompt).not.toContain("出力例");
    expect(en.calls[0].userPrompt).toContain("[OUTPUT LANGUAGE — STRICT]");
  });

  it("languageNotes は userPrompt に反映され、空白のみなら何も変わらない", async () => {
    const none = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, none.adapter);
    const withNotes = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, withNotes.adapter, {
      languageNotes: "ゆっくりめの語り口",
    });
    const blank = fakeAdapter({ title: "t", body: "b" });
    await generateProgramScript(items, blank.adapter, { languageNotes: "   " });

    expect(withNotes.calls[0].userPrompt).toContain("ゆっくりめの語り口");
    // 空白のみの notes は、notes 無しとプロンプトが完全一致する
    expect(blank.calls[0].userPrompt).toBe(none.calls[0].userPrompt);
    expect(withNotes.calls[0].userPrompt).not.toBe(none.calls[0].userPrompt);
  });
});
