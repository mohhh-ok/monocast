import { z } from "zod";

const EnvSchema = z
  .object({
    LLM_PROVIDER: z.enum(["anthropic", "ollama"]).default("anthropic"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-4-5"),
    OLLAMA_URL: z.string().url().default("http://localhost:11434"),
    OLLAMA_MODEL: z.string().min(1).default("qwen2.5:7b-instruct"),
    VOICEVOX_URL: z.string().url().default("http://localhost:50021"),
    VOICEVOX_SPEAKER: z.coerce.number().int().default(2),
  })
  .superRefine((v, ctx) => {
    if (v.LLM_PROVIDER === "anthropic" && !v.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ANTHROPIC_API_KEY"],
        message: "LLM_PROVIDER=anthropic のとき ANTHROPIC_API_KEY は必須",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".")}: ${i.message}`,
    );
    throw new Error(`環境変数の検証に失敗:\n${lines.join("\n")}`);
  }
  cached = result.data;
  return cached;
}
