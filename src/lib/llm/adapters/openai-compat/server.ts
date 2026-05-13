import type {
  LlmAdapter,
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmId,
} from "../types";

export type OpenAiCompatAdapterOptions = {
  id: Extract<LlmId, "openai">;
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

/**
 * OpenAI Chat Completions API を叩く adapter。
 */
export function createOpenAiCompatAdapter(opts: OpenAiCompatAdapterOptions): LlmAdapter {
  const { id, label, baseUrl, model, apiKey } = opts;

  return {
    id,
    label,
    model,
    async generate({ systemPrompt, userPrompt, schema }: LlmGenerateInput): Promise<LlmGenerateOutput> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          temperature: 0.7,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "submit_script",
              strict: true,
              schema,
            },
          },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${id} chat failed: ${res.status} ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      try {
        return JSON.parse(content) as LlmGenerateOutput;
      } catch {
        throw new Error(`${id} JSON parse failed: ${content.slice(0, 200)}`);
      }
    },
  };
}
