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
      const res = await client.messages.create({
        model,
        max_tokens: 1500,
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
        throw new Error("Anthropic から tool_use 応答が返ってこなかった");
      }
      return toolUse.input as LlmGenerateOutput;
    },
  };
}
