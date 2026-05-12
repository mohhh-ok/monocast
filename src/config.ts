import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ConfigSchema,
  DEFAULT_CONFIG,
  LLM_IDS,
  TTS_IDS,
  type Config,
  type LlmId,
  type TtsId,
} from "./config.shared";

export { ConfigSchema, DEFAULT_CONFIG, LLM_IDS, TTS_IDS };
export type { Config, LlmId, TtsId };

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

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
