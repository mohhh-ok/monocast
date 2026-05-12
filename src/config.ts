import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

export const LLM_IDS = ["anthropic", "openai", "gemini", "ollama"] as const;
export type LlmId = (typeof LLM_IDS)[number];

export const ConfigSchema = z.object({
  /** 番組生成に使う LLM。複数選択で N 本生成される。 */
  selectedLlms: z.array(z.enum(LLM_IDS)).default(["anthropic"]),
  anthropicModel: z.string().min(1).default("claude-haiku-4-5"),
  openaiModel: z.string().min(1).default("gpt-4o-mini"),
  geminiModel: z.string().min(1).default("gemini-1.5-flash"),
  ollamaUrl: z.string().url().default("http://localhost:11434"),
  ollamaModel: z.string().min(1).default("qwen2.5:7b-instruct"),
  voicevoxUrl: z.string().url().default("http://localhost:50021"),
  voicevoxSpeaker: z.coerce.number().int().nonnegative().default(2),
  // null = 全ソース有効（デフォルト）、配列 = 明示選択、[] = 全 OFF
  enabledSources: z.array(z.string()).nullable().default(null),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

export async function getConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = ConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(patch: Partial<Config>): Promise<Config> {
  const current = await getConfig();
  const next = ConfigSchema.parse({ ...current, ...patch });
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
