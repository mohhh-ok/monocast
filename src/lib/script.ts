import type { LlmAdapter } from "./llm";
import type { NewsItem } from "./news";

const SYSTEM_PROMPT = `あなたは「ききながしラジオ」のパーソナリティです。
作業中や寝る前に流して心地よい、落ち着いたトーンの日本語ナレーション原稿を書きます。

ルール:
- 1人語り。聴取者への呼びかけは控えめに、淡々と。
- 渡された素材は必ず全件紹介する。スキップ・統合・省略は禁止。素材の順番通りに扱う。
- 1記事あたり 5〜8 文、かつ 250〜400 字。見出しだけで終わらせず、概要から踏み込んで背景・要点・関連する反応や今後の見通しにも触れる。文を短く切り詰めて 250 字を下回るのは不可。
- 数字や固有名詞は読みやすく。英字略語は日本語読みを優先（例: AI → エーアイ）。
- 英語のニュース素材は自然な日本語に意訳して紹介する。原文のまま英語を読み上げない。
- 記事間は「続いてのニュースです。」「次の話題です。」など軽い繋ぎを入れる。
- 番組の冒頭に短い挨拶、最後に短い締めを置く。BGM 指示や効果音は書かない。
- 出力は読み上げ原稿のみ。記号やマークダウンは使わない。
- 段落の区切りには必ず改行 \\n を入れる。1段落は最大でも 400 字以内に収め、改行のない長文ベタ書きは禁止。1記事につき 1 段落以上。
- 各記事の文数（5〜8文）・字数（250〜400字）と全件紹介のルールを厳守すること。記事を端折って短く済ませる原稿は不可。`;

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

  const userPrompt = `以下の ${items.length} 件のニュース項目を素材に、ききながしラジオの 1 番組分の原稿を書いてください。${items.length} 件すべてを必ず紹介してください。素材を間引いたり、複数の素材を1つにまとめたりしないでください。

ニュース素材:
${itemList}

JSON で {"title": "...", "body": "..."} の形で返してください。title は 20 文字以内の番組タイトル、body は読み上げ原稿のみ（記号・マークダウンなし）。

body は必ず段落ごとに改行 \\n で区切り、1記事の段落は 250〜400 字に収めてください。改行ゼロのベタ書きや、250 字に満たない短い段落は不可です。

出力例（形式の参考。トピックは真似しない）:
{"title":"夜のききながしニュース","body":"こんばんは。ききながしラジオの時間です。今夜もいくつかの話題を順番にお届けします。\\n最初の話題です。海外の研究機関が、これまでより小型でありながら同等の性能を持つ人工知能モデルを公開しました。一般的なノートパソコンでも動かせる程度の省電力設計で、推論コストの大幅な削減につながると説明されています。研究チームは学習データの量より質を重視したとのことで、同規模の従来モデルを上回る精度を示したそうです。すでに研究目的でのライセンスが公開されており、各国の大学からも検証の報告が出始めています。\\n続いてのニュースです。国内では、地域の図書館が深夜まで開館する取り組みを始めました。対象は週末を中心に、終電前まで自習スペースと一部の閲覧室を開放する形です。仕事帰りの利用者からは、静かに集中できる場所が増えてうれしいという声が寄せられているとのこと。一方で、運営側は人員配置と防犯面の課題を挙げており、利用状況を見ながら平日への拡大を検討するそうです。\\nそれでは今日はこのあたりで。よい夜をお過ごしください。"}`;

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
