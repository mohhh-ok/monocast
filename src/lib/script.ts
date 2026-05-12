import type { LlmAdapter } from "./llm";
import type { NewsItem } from "./news";

const SYSTEM_PROMPT = `あなたは「ききながしラジオ」のパーソナリティです。
作業中や寝る前に流して心地よい、落ち着いたトーンの日本語ナレーション原稿を書きます。

ルール:
- 1人語り。聴取者への呼びかけは控えめに、淡々と。
- 1記事あたり 3〜5 文。見出しだけで終わらせず、概要から少し踏み込んで背景や要点も触れる。
- 数字や固有名詞は読みやすく。英字略語は日本語読みを優先（例: AI → エーアイ）。
- 英語のニュース素材は自然な日本語に意訳して紹介する。原文のまま英語を読み上げない。
- 記事間は「続いてのニュースです。」「次の話題です。」など軽い繋ぎを入れる。
- 番組の冒頭に短い挨拶、最後に短い締めを置く。BGM 指示や効果音は書かない。
- 出力は読み上げ原稿のみ。記号やマークダウンは使わない。改行は段落ごとに1つ。
- 全体で 2 分〜3 分（およそ 700〜1100 字）で読み切れる分量にする。短すぎる原稿は不可。`;

const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "番組タイトル。20文字以内。",
    },
    body: {
      type: "string",
      description:
        "読み上げ原稿本体。記号やマークダウンは含めない。段落は改行で区切る。",
    },
  },
  required: ["title", "body"],
  additionalProperties: false,
} as const;

export type ProgramScript = {
  title: string;
  body: string;
  sources: { title: string; link: string; source: string }[];
};

export async function generateProgramScript(
  items: NewsItem[],
  adapter: LlmAdapter,
): Promise<ProgramScript> {
  const itemList = items
    .map(
      (it, i) =>
        `${i + 1}. [${it.source}] ${it.title}\n   概要: ${
          it.contentSnippet || "（概要なし）"
        }`,
    )
    .join("\n");

  const userPrompt = `以下のニュース項目を素材に、ききながしラジオの 1 番組分の原稿を書いてください。

ニュース素材:
${itemList}

JSON で {"title": "...", "body": "..."} の形で返してください。title は 20 文字以内の番組タイトル、body は読み上げ原稿のみ（記号・マークダウンなし、段落は改行で区切る）。`;

  const parsed = await adapter.generate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: SCRIPT_SCHEMA,
  });

  return {
    title: parsed.title.trim() || "ききながしニュース",
    body: parsed.body.trim(),
    sources: items.map((it) => ({
      title: it.title,
      link: it.link,
      source: it.source,
    })),
  };
}
