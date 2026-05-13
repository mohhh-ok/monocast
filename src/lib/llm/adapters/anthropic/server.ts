import Anthropic from "@anthropic-ai/sdk";
import type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput } from "../types";

export type AnthropicAdapterOptions = {
  model: string;
};

export function createAnthropicAdapter(opts: AnthropicAdapterOptions): LlmAdapter {
  const { model } = opts;
  return {
    id: "anthropic",
    label: `Anthropic (${model})`,
    model,
    async generate({ systemPrompt, userPrompt, schema }: LlmGenerateInput): Promise<LlmGenerateOutput> {
      const client = new Anthropic();
      const max_tokens = 8000;
      const res = await client.messages.create({
        model,
        max_tokens,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: "submit_script",
            description: "完成した番組原稿を提出する",
            input_schema: schema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: "submit_script" },
        messages: [{ role: "user", content: userPrompt }],
      });

      const toolUse = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) {
        const blockTypes = res.content.map((b) => b.type).join(",");
        const textBlock = res.content.find(
          (b): b is Anthropic.TextBlock => b.type === "text",
        );
        throw new Error(
          `Anthropic から tool_use 応答なし (stop_reason=${res.stop_reason ?? "?"}, blocks=[${blockTypes}]${
            textBlock ? `, text=${textBlock.text.slice(0, 200)}` : ""
          })`,
        );
      }
      const input = toolUse.input as Partial<LlmGenerateOutput>;
      if (
        res.stop_reason === "max_tokens" ||
        typeof input?.title !== "string" ||
        typeof input?.body !== "string"
      ) {
        const keys = input && typeof input === "object" ? Object.keys(input).join(",") : typeof input;
        const titleLen = typeof input?.title === "string" ? input.title.length : "-";
        const bodyLen = typeof input?.body === "string" ? input.body.length : "-";
        throw new Error(
          `Anthropic tool_use が不完全 (stop_reason=${res.stop_reason ?? "?"}, max_tokens=${max_tokens}, keys=${keys}, titleLen=${titleLen}, bodyLen=${bodyLen}, usage=in:${res.usage.input_tokens}/out:${res.usage.output_tokens})`,
        );
      }
      return input as LlmGenerateOutput;
    },
  };
}
