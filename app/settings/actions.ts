"use server";

import { getConfig, saveConfig, type Config } from "@/config";

export async function loadConfig(): Promise<Config> {
  return getConfig();
}

export type UpdateResult =
  | { status: "ok"; config: Config }
  | { status: "error"; message: string };

export async function updateConfig(patch: Partial<Config>): Promise<UpdateResult> {
  try {
    const next = await saveConfig(patch);
    return { status: "ok", config: next };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export type SpeakerOption = { id: number; label: string };

export async function fetchSpeakers(): Promise<SpeakerOption[]> {
  const cfg = await getConfig();
  try {
    const res = await fetch(`${cfg.voicevoxUrl}/speakers`, { cache: "no-store" });
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
