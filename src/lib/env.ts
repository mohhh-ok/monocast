import { z } from "zod";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  // ローカルエンジンの接続先 URL。プロファイル単位ではなく環境全体で 1 つ。
  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  VOICEVOX_URL: z.string().url().default("http://localhost:50021"),
  AIVISSPEECH_URL: z.string().url().default("http://localhost:10101"),
  KOKORO_URL: z.string().url().default("http://localhost:8880"),
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
