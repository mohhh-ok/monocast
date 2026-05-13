import { languageHumanName } from "./lang";
import type { LlmAdapter } from "./llm";
import type { NewsItem } from "./news";

function buildSystemPrompt(languageCode: string): string {
  const isJa = languageCode === "ja" || languageCode === "";
  const langName = languageHumanName(languageCode || "ja");
  if (isJa) {
    return `あなたは「ききながしラジオ」のパーソナリティです。
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
  }
  return `You are the host of a calm, ambient-listening radio program called "Monocast".
The script is meant to be played in the background while working or before sleep, so the tone stays soft and steady.

The user prompt that follows is written in Japanese for convenience, but the output language is strictly ${langName} (${languageCode}). Write the entire narration — title and body — in ${langName}. Translate or paraphrase any source material that is in another language; never read the original text verbatim if it is not in ${langName}, and do not leave Japanese characters in the output even for proper nouns.

Rules:
- Solo monologue. Address the listener sparingly and gently.
- Every supplied item must be covered. Do not skip, merge, or summarize across items. Keep the original order.
- For each item, write roughly 5–8 sentences and a paragraph long enough to give context, background and outlook — not just the headline. Do not cut a paragraph short.
- Read numbers and proper nouns naturally for spoken delivery in ${langName}.
- Insert a light transition phrase between items (the equivalent of "next" or "moving on" in ${langName}).
- Open with a short greeting and close with a short sign-off. Do not write BGM or sound-effect cues.
- Output the spoken script only. No symbols, no markdown.
- Separate paragraphs with newline \\n. Each paragraph stays under 400 characters/words of the target language. No wall-of-text.
- Keep all of the above strict — do not shorten the show by skipping items.`;
}

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

function jstHour(d = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    hour12: false,
  });
  return Number(fmt.format(d).replace(/[^0-9]/g, ""));
}

function timeSlotLabel(h: number): string {
  if (h >= 5 && h < 10) return "朝";
  if (h >= 10 && h < 15) return "昼";
  if (h >= 15 && h < 19) return "夕方";
  if (h >= 19 && h < 23) return "夜";
  return "深夜";
}

const SLOT_EXAMPLE_GREETINGS: Record<string, { open: string; close: string }> = {
  朝: {
    open: "おはようございます。ききながしラジオの時間です。今朝もいくつかの話題を順番にお届けします。",
    close: "それでは今日はこのあたりで。よい一日をお過ごしください。",
  },
  昼: {
    open: "こんにちは。ききながしラジオの時間です。お昼のひとときにいくつかの話題を順番にお届けします。",
    close: "それではこのあたりで。よい午後をお過ごしください。",
  },
  夕方: {
    open: "こんばんは。ききながしラジオの時間です。日が傾く頃、いくつかの話題を順番にお届けします。",
    close: "それでは今日はこのあたりで。よい夕べをお過ごしください。",
  },
  夜: {
    open: "こんばんは。ききながしラジオの時間です。今夜もいくつかの話題を順番にお届けします。",
    close: "それでは今日はこのあたりで。よい夜をお過ごしください。",
  },
  深夜: {
    open: "こんばんは。ききながしラジオの時間です。静かな深夜の時間に、いくつかの話題を順番にお届けします。",
    close: "それでは今日はこのあたりで。どうぞよい夢を。",
  },
};

function exampleBody(slot: string): string {
  const g = SLOT_EXAMPLE_GREETINGS[slot] ?? SLOT_EXAMPLE_GREETINGS["夜"];
  return `${g.open}\\n最初の話題です。海外の研究機関が、これまでより小型でありながら同等の性能を持つ人工知能モデルを公開しました。一般的なノートパソコンでも動かせる程度の省電力設計で、推論コストの大幅な削減につながると説明されています。研究チームは学習データの量より質を重視したとのことで、同規模の従来モデルを上回る精度を示したそうです。すでに研究目的でのライセンスが公開されており、各国の大学からも検証の報告が出始めています。\\n続いてのニュースです。国内では、地域の図書館が深夜まで開館する取り組みを始めました。対象は週末を中心に、終電前まで自習スペースと一部の閲覧室を開放する形です。仕事帰りの利用者からは、静かに集中できる場所が増えてうれしいという声が寄せられているとのこと。一方で、運営側は人員配置と防犯面の課題を挙げており、利用状況を見ながら平日への拡大を検討するそうです。\\n${g.close}`;
}

export type GenerateScriptOptions = {
  /** 出力言語の BCP 47 風コード。"ja" / "en-US" など。 */
  languageCode?: string;
  /** 言語に関する追加のニュアンス指示。空文字なら添えない。 */
  languageNotes?: string;
};

export async function generateProgramScript(
  items: NewsItem[],
  adapter: LlmAdapter,
  opts: GenerateScriptOptions = {},
): Promise<ProgramScript> {
  const languageCode = opts.languageCode || "ja";
  const languageNotes = (opts.languageNotes ?? "").trim();
  const isJa = languageCode === "ja";
  const langName = languageHumanName(languageCode);

  const itemList = items
    .map(
      (it, i) =>
        `${i + 1}. [${it.source}] ${it.title}\n   概要: ${
          it.contentSnippet || "（概要なし）"
        }`,
    )
    .join("\n");

  const slot = timeSlotLabel(jstHour());

  // 日本語以外の場合、出力例の日本語サンプルは外す（言語が混ざる原因になるため）。
  const exampleLine = isJa
    ? `\n\n出力例（形式の参考のみ。title は毎回ゼロから考えること。例の文字列をそのまま使わない）:\n{"title":"（ここに 20 文字以内の番組タイトル）","body":"${exampleBody(slot)}"}`
    : "";

  // 出力言語が日本語以外のときは、user prompt の冒頭に強い指示を置く。
  // 末尾に小さく添えるだけだと、ニュース素材や指示文の日本語に引きずられて
  // 日本語で返ってきてしまう。
  const languageHeader = isJa
    ? ""
    : `[OUTPUT LANGUAGE — STRICT]
The following instructions and source items are written in Japanese, but the output must be entirely in ${langName} (${languageCode}).
- Write the JSON values for "title" and "body" only in ${langName}.
- Translate or paraphrase any Japanese source items into ${langName}; never quote them verbatim in Japanese.
- Do not mix Japanese characters into the output, even for proper nouns — use the ${langName} reading.

`;

  const notesDirective = languageNotes
    ? `\n\n追加のニュアンス指示（言語スタイル）: ${languageNotes}`
    : "";

  const userPrompt = `${languageHeader}以下の ${items.length} 件のニュース項目を素材に、ききながしラジオの 1 番組分の原稿を書いてください。${items.length} 件すべてを必ず紹介してください。素材を間引いたり、複数の素材を1つにまとめたりしないでください。

配信時間帯: ${slot}

ニュース素材:
${itemList}

JSON で {"title": "...", "body": "..."} の形で返してください。body は読み上げ原稿のみ（記号・マークダウンなし）。

title（番組タイトル）のルール:
- 20 文字以内。記号・絵文字・かぎ括弧は使わない。
- 配信時間帯「${slot}」の雰囲気、または素材の中心となるテーマ・キーワードのどちらかを毎回違う切り口で反映する。
- 「ききながしニュース」「ききながしラジオ」のような番組名そのままの固定句は使わない。
- 「○○の○○便」「○○の○○ラジオ」のようなテンプレ語尾に固執しない。毎回語感を変える。
- 過度に煽情的・断定的な見出しは避け、心地よい落ち着いた語感にする。

body は必ず段落ごとに改行 \\n で区切り、1記事の段落は 250〜400 字に収めてください。改行ゼロのベタ書きや、250 字に満たない短い段落は不可です。${notesDirective}${exampleLine}`;

  const parsed = await adapter.generate({
    systemPrompt: buildSystemPrompt(languageCode),
    userPrompt,
    schema: SCRIPT_SCHEMA,
  });

  const title = typeof parsed?.title === "string" ? parsed.title : "";
  const body = typeof parsed?.body === "string" ? parsed.body : "";
  if (!body.trim()) {
    const preview = JSON.stringify(parsed)?.slice(0, 300) ?? String(parsed);
    throw new Error(
      `LLM応答に body が含まれていません (adapter=${adapter.id}/${adapter.model}, keys=${
        parsed && typeof parsed === "object" ? Object.keys(parsed).join(",") : typeof parsed
      }, preview=${preview})`,
    );
  }

  // LLM がタイトルを空で返した場合のフォールバック。slot を使った日本語ラベルは
  // 多言語で崩壊するので、ブランド名で統一する。
  return {
    title: title.trim() || "Monocast",
    body: body.trim(),
    sources: items.map((it) => ({
      title: it.title,
      link: it.link,
      source: it.source,
    })),
  };
}
