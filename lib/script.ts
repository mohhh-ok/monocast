import Anthropic from "@anthropic-ai/sdk";
import type { NewsItem } from "./news";

const client = new Anthropic();

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `あなたは「ききながしラジオ」のパーソナリティです。
作業中や寝る前に流して心地よい、落ち着いたトーンの日本語ナレーション原稿を書きます。

ルール:
- 1人語り。聴取者への呼びかけは控えめに、淡々と。
- 1記事あたり 2〜4 文程度で簡潔に伝える。
- 数字や固有名詞は読みやすく。英字略語は日本語読みを優先（例: AI → エーアイ）。
- 記事間は「続いてのニュースです。」「次の話題です。」など軽い繋ぎを入れる。
- 番組の冒頭に短い挨拶、最後に短い締めを置く。BGM 指示や効果音は書かない。
- 出力は読み上げ原稿のみ。記号やマークダウンは使わない。改行は段落ごとに1つ。
- 全体で 90 秒〜180 秒で読み切れる分量にする。`;

export type ProgramScript = {
  title: string;
  body: string;
  sources: { title: string; link: string; source: string }[];
};

export async function generateProgramScript(
  items: NewsItem[],
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

出力形式（厳密に守る）:
TITLE: <番組タイトル 20文字以内>
---
<本文。読み上げ原稿のみ>`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const parsed = parseScript(text);
  return {
    title: parsed.title,
    body: parsed.body,
    sources: items.map((it) => ({
      title: it.title,
      link: it.link,
      source: it.source,
    })),
  };
}

function parseScript(text: string): { title: string; body: string } {
  const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "ききながしニュース";
  const sepIdx = text.indexOf("---");
  const body = sepIdx >= 0 ? text.slice(sepIdx + 3).trim() : text;
  return { title, body };
}
