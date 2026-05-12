import Anthropic from "@anthropic-ai/sdk";
import type { NewsItem } from "./news";
import { getEnv } from "./env";

export type LlmProvider = "anthropic" | "ollama";

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
  provider: LlmProvider,
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

  const parsed =
    provider === "ollama"
      ? await callOllama(userPrompt)
      : await callAnthropic(userPrompt);

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

async function callAnthropic(
  userPrompt: string,
): Promise<{ title: string; body: string }> {
  const env = getEnv();
  const client = new Anthropic();
  const res = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "submit_script",
        description: "完成した番組原稿を提出する",
        input_schema: SCRIPT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "submit_script" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Anthropic から tool_use 応答が返ってこなかった");
  }
  return toolUse.input as { title: string; body: string };
}

async function callOllama(
  userPrompt: string,
): Promise<{ title: string; body: string }> {
  const env = getEnv();
  const res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      stream: false,
      format: SCRIPT_SCHEMA,
      options: { temperature: 0.7 },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";
  try {
    return JSON.parse(content) as { title: string; body: string };
  } catch {
    throw new Error(`Ollama JSON parse failed: ${content.slice(0, 200)}`);
  }
}
