import { spawn } from "node:child_process";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ConfigSchema, getConfig, saveConfig, type Config } from "@/config";
import { listSources, SourceOptionSchema } from "@/lib/news";
import type { SourceOption } from "@/lib/news";

export type UpdateResult =
  | { status: "ok"; config: Config }
  | { status: "error"; message: string };

export type SpeakerOption = { id: number; label: string };

export type SayVoiceOption = { name: string; locale: string };

export type { SourceOption } from "@/lib/news";

export const loadConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Config> => {
    return getConfig();
  },
);

export const updateConfigFn = createServerFn({ method: "POST" })
  .inputValidator(ConfigSchema.partial())
  .handler(async ({ data }): Promise<UpdateResult> => {
    try {
      const next = await saveConfig(data);
      return { status: "ok", config: next };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

export const listSourcesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SourceOption[]> => {
    return listSources().flatMap((s) => {
      const parsed = SourceOptionSchema.safeParse({
        id: s.id,
        name: s.name,
        category: s.category,
      });
      return parsed.success ? [parsed.data] : [];
    });
  },
);

export const fetchSayVoicesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SayVoiceOption[]> => {
    try {
      const out = await runCmd("say", ["-v", "?"]);
      const voices: SayVoiceOption[] = [];
      for (const line of out.split(/\r?\n/)) {
        const hashIdx = line.indexOf("#");
        const left = (hashIdx >= 0 ? line.slice(0, hashIdx) : line).trimEnd();
        if (!left.trim()) continue;
        const m = left.match(/^(.+?)\s+([a-z]{2,3}[_-][A-Za-z]{2,4})\s*$/);
        if (!m) continue;
        voices.push({ name: m[1].trim(), locale: m[2] });
      }
      voices.sort((a, b) => {
        const aJa = a.locale.startsWith("ja") ? 0 : 1;
        const bJa = b.locale.startsWith("ja") ? 0 : 1;
        if (aJa !== bJa) return aJa - bJa;
        return a.locale.localeCompare(b.locale) || a.name.localeCompare(b.name);
      });
      return voices;
    } catch {
      return [];
    }
  },
);

function runCmd(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-200)}`));
    });
  });
}

async function fetchVoicevoxCompatSpeakers(url: string): Promise<SpeakerOption[]> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/speakers`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      name: string;
      styles: Array<{ id: number; name: string }>;
    }>;
    return data.flatMap((sp) =>
      sp.styles.map((st) => ({
        id: st.id,
        label: `${sp.name} (${st.name})`,
      })),
    );
  } catch {
    return [];
  }
}

export const fetchSpeakersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpeakerOption[]> => {
    const cfg = await getConfig();
    return fetchVoicevoxCompatSpeakers(cfg.voicevoxUrl);
  },
);

export const fetchAivisSpeakersFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ url: z.string().url() }).optional())
  .handler(async ({ data }): Promise<SpeakerOption[]> => {
    const cfg = await getConfig();
    const url = data?.url ?? cfg.aivisSpeechUrl;
    return fetchVoicevoxCompatSpeakers(url);
  });
