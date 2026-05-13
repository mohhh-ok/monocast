export type LlmGenerateInput = {
  systemPrompt: string;
  userPrompt: string;
  /** {title, body} を返させるための JSON schema */
  schema: Record<string, unknown>;
};

export type LlmGenerateOutput = {
  title: string;
  body: string;
};

/** 設定で識別するための ID。adapter の種類でもある。 */
export type LlmId = "anthropic" | "openai" | "gemini" | "ollama";

export type LlmAdapter = {
  readonly id: LlmId;
  /** UI 表示用ラベル。例: "Anthropic (claude-haiku-4-5)" */
  readonly label: string;
  /** 実際に呼び出されたモデル名（番組に記録される） */
  readonly model: string;
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
};

export type LlmCommon = {};
