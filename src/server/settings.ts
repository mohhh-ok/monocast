import { createServerFn } from "@tanstack/react-start";
import { ConfigSchema, getConfig, saveConfig, type Config } from "@/config";

export type UpdateResult =
  | { status: "ok"; config: Config }
  | { status: "error"; message: string };

export type SpeakerOption = { id: number; label: string };

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

export const fetchSpeakersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpeakerOption[]> => {
    const cfg = await getConfig();
    try {
      const res = await fetch(`${cfg.voicevoxUrl}/speakers`, {
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
  },
);
