import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runProc } from "@/lib/proc";
import {
  ConfigSchema,
  createProfile,
  deleteProfile,
  getActiveProfileId,
  getConfig,
  getProfileConfig,
  listProfiles,
  renameProfile,
  saveConfig,
  setActiveProfile,
  type Config,
  type ProfileMeta,
} from "@/config";
import { listSources, SourceOptionSchema } from "@/lib/news";
import type { SourceOption } from "@/lib/news";

export type UpdateResult =
  | { status: "ok"; config: Config }
  | { status: "error"; message: string };

export type ProfilesState = {
  profiles: ProfileMeta[];
  activeProfileId: string;
};

export type ProfilesResult =
  | { status: "ok"; state: ProfilesState }
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
  .inputValidator(
    z.object({
      profileId: z.string().min(1).max(64).optional(),
      patch: ConfigSchema.partial(),
    }),
  )
  .handler(async ({ data }): Promise<UpdateResult> => {
    try {
      const next = await saveConfig(data.patch, data.profileId);
      return { status: "ok", config: next };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

export const loadProfileConfigFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data }): Promise<Config | null> => getProfileConfig(data.id));

async function snapshotProfiles(): Promise<ProfilesState> {
  const [profiles, activeProfileId] = await Promise.all([
    listProfiles(),
    getActiveProfileId(),
  ]);
  return { profiles, activeProfileId };
}

export const listProfilesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProfilesState> => snapshotProfiles(),
);

export const createProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(64),
      fromId: z.string().min(1).max(64).optional(),
    }),
  )
  .handler(async ({ data }): Promise<ProfilesResult> => {
    try {
      await createProfile(data);
      return { status: "ok", state: await snapshotProfiles() };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

export const renameProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().min(1).max(64),
      name: z.string().min(1).max(64),
    }),
  )
  .handler(async ({ data }): Promise<ProfilesResult> => {
    try {
      await renameProfile(data.id, data.name);
      return { status: "ok", state: await snapshotProfiles() };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

export const deleteProfileFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data }): Promise<ProfilesResult> => {
    try {
      await deleteProfile(data.id);
      return { status: "ok", state: await snapshotProfiles() };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

export const setActiveProfileFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data }): Promise<ProfilesResult> => {
    try {
      await setActiveProfile(data.id);
      return { status: "ok", state: await snapshotProfiles() };
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
      const { stdout } = await runProc("say", ["-v", "?"]);
      const voices: SayVoiceOption[] = [];
      for (const line of stdout.split(/\r?\n/)) {
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
