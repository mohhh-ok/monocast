import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

export const ConfigSchema = z.object({
  llmProvider: z.enum(["anthropic", "ollama"]).default("anthropic"),
  anthropicModel: z.string().min(1).default("claude-haiku-4-5"),
  ollamaUrl: z.string().url().default("http://localhost:11434"),
  ollamaModel: z.string().min(1).default("qwen2.5:7b-instruct"),
  voicevoxUrl: z.string().url().default("http://localhost:50021"),
  voicevoxSpeaker: z.coerce.number().int().nonnegative().default(2),
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
