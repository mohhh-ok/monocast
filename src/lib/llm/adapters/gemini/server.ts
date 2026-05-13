import type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput } from "../types";

export type GeminiAdapterOptions = {
  model: string;
  apiKey: string;
};

/**
 * Google Gemini REST API を直接叩く adapter。
 * @google/genai SDK を入れずに fetch で済ませる。
 */
export function createGeminiAdapter(opts: GeminiAdapterOptions): LlmAdapter {
  const { model, apiKey } = opts;

  return {
    id: "gemini",
    label: `Gemini (${model})`,
    model,
    async generate({ systemPrompt, userPrompt, schema }: LlmGenerateInput): Promise<LlmGenerateOutput> {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
        `?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: stripUnsupportedKeys(schema),
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gemini chat failed: ${res.status} ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      try {
        return JSON.parse(text) as LlmGenerateOutput;
      } catch {
        throw new Error(`Gemini JSON parse failed: ${text.slice(0, 200)}`);
      }
    },
  };
}

/** Gemini の responseSchema は additionalProperties を受け付けないので落とす。 */
function stripUnsupportedKeys(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "additionalProperties") continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = stripUnsupportedKeys(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
