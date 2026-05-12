import type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput } from "../types";

export type OllamaAdapterOptions = {
  baseUrl: string;
  model: string;
};

/**
 * Ollama のネイティブ /api/chat を叩く adapter。
 * format に JSON schema を渡して constrained decoding でスキーマを強制する。
 * OpenAI 互換 (/v1/chat/completions) では response_format の json_schema が
 * 確実には尊重されず自由文が返ってしまうため、こちらを使う。
 */
export function createOllamaAdapter(opts: OllamaAdapterOptions): LlmAdapter {
  const { baseUrl, model } = opts;

  return {
    id: "ollama",
    label: `Ollama (${model})`,
    model,
    async generate({ systemPrompt, userPrompt, schema }: LlmGenerateInput): Promise<LlmGenerateOutput> {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: schema,
          options: { temperature: 0.7, num_predict: 2048 },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`ollama chat failed: ${res.status} ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        message?: { content?: string };
      };
      const content = data.message?.content ?? "";
      try {
        return JSON.parse(content) as LlmGenerateOutput;
      } catch {
        throw new Error(`ollama JSON parse failed: ${content.slice(0, 200)}`);
      }
    },
  };
}
