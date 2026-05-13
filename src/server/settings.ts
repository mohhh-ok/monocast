import { createServerFn } from "@tanstack/react-start";
import Parser from "rss-parser";
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
import type { ProducePhase } from "@/lib/produce";
import { cancelInFlight, getInFlightSnapshot } from "./programs";

// 進行中フェーズで実際に「使う」設定キー。これらが変わったらキャンセル対象。
// - news: ニュース取得中。enabledSources のほか、これから走る script/tts も影響あり。
// - script: 台本生成中。LLM 関連 + これから走る tts も影響あり（news は終了済み）。
// - tts: 音声合成中。TTS 関連のみ影響（script/news は終了済み）。
// - done: 完了直前。基本的に何も影響しないが念のため空集合。
const LLM_KEYS: ReadonlyArray<keyof Config> = [
  "selectedLlm",
  "anthropicModel",
  "openaiModel",
  "geminiModel",
  "ollamaUrl",
  "ollamaModel",
];
const TTS_KEYS: ReadonlyArray<keyof Config> = [
  "selectedTts",
  "voicevoxUrl",
  "voicevoxSpeaker",
  "aivisSpeechUrl",
  "aivisSpeechSpeaker",
  "sayVoice",
  "sayRate",
  "sapiVoice",
  "sapiRate",
  "openaiTtsModel",
  "openaiTtsVoice",
  "elevenlabsModelId",
  "elevenlabsVoiceId",
  "kokoroUrl",
  "kokoroVoice",
  "ttsConcurrency",
];
const SOURCE_KEYS: ReadonlyArray<keyof Config> = ["rssUrls"];

const PHASE_AFFECTING_KEYS: Record<ProducePhase, ReadonlySet<keyof Config>> = {
  news: new Set([...SOURCE_KEYS, ...LLM_KEYS, ...TTS_KEYS]),
  script: new Set([...LLM_KEYS, ...TTS_KEYS]),
  tts: new Set(TTS_KEYS),
  done: new Set(),
};

/** patch のうち、現在値から実際に変わったキーだけを返す。 */
function changedKeys(prev: Config, patch: Partial<Config>): Array<keyof Config> {
  const out: Array<keyof Config> = [];
  for (const k of Object.keys(patch) as Array<keyof Config>) {
    const next = patch[k];
    if (next === undefined) continue;
    const before = prev[k];
    if (JSON.stringify(before) !== JSON.stringify(next)) out.push(k);
  }
  return out;
}

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

export type SapiVoiceOption = { name: string; locale: string };

export type RssFeedProbe = {
  url: string;
  status: "ok" | "error";
  title?: string;
  itemCount?: number;
  error?: string;
};

export const loadConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Config> => {
    return getConfig();
  },
);

// ConfigSchema.partial() は zod v4 でも .default() を保持し、parse 時にデフォルトを
// 全フィールドに埋め戻してしまう。これでは「届いた patch」だけを抽出できないため、
// patch 部分は手動でキーごとに validate する。
function parsePatch(raw: unknown): Partial<Config> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Config> = {};
  const shape = ConfigSchema.shape as Record<string, z.ZodTypeAny>;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const field = shape[k];
    if (!field || v === undefined) continue;
    const parsed = field.safeParse(v);
    if (parsed.success) {
      (out as Record<string, unknown>)[k] = parsed.data;
    }
  }
  return out;
}

export const updateConfigFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profileId: z.string().min(1).max(64).optional(),
      patch: z.unknown().transform(parsePatch),
    }),
  )
  .handler(async ({ data }): Promise<UpdateResult> => {
    try {
      // 進行中タスクが「いま使ってる」設定が書き換わるなら中断する。
      // 進行中タスクと別プロファイルへの編集はスルー（アクティブ profile しか produce は使わない）。
      const inflight = getInFlightSnapshot();
      if (inflight) {
        const targetProfileId =
          data.profileId ?? (await getActiveProfileId());
        if (targetProfileId === inflight.profileId) {
          const prev = await getConfig();
          const changed = changedKeys(prev, data.patch);
          const affecting = PHASE_AFFECTING_KEYS[inflight.phase];
          const hit = changed.filter((k) => affecting.has(k));
          if (hit.length > 0) {
            cancelInFlight(`settings changed: ${hit.join(",")}`);
          }
        }
      }
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

export const probeRssUrlsFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      urls: z.array(z.string()).max(64),
    }),
  )
  .handler(async ({ data }): Promise<RssFeedProbe[]> => {
    const parser = new Parser({ timeout: 8000 });
    return Promise.all(
      data.urls.map(async (url): Promise<RssFeedProbe> => {
        const trimmed = url.trim();
        if (!trimmed) {
          return { url, status: "error", error: "空の URL" };
        }
        try {
          new URL(trimmed);
        } catch {
          return { url: trimmed, status: "error", error: "URL 形式が不正" };
        }
        try {
          const feed = await parser.parseURL(trimmed);
          return {
            url: trimmed,
            status: "ok",
            title: (feed.title ?? "").trim() || undefined,
            itemCount: feed.items?.length ?? 0,
          };
        } catch (err) {
          return {
            url: trimmed,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
  });

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

export const fetchSapiVoicesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SapiVoiceOption[]> => {
    if (process.platform !== "win32") return [];
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.Speech",
      "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
      "foreach ($v in $s.GetInstalledVoices()) {",
      "  $i = $v.VoiceInfo",
      "  [PSCustomObject]@{ name = $i.Name; culture = $i.Culture.Name } | ConvertTo-Json -Compress",
      "}",
    ].join("\r\n");
    try {
      const { stdout } = await runProc("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ]);
      const voices: SapiVoiceOption[] = [];
      for (const line of stdout.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t) as { name?: unknown; culture?: unknown };
          if (typeof obj.name === "string" && typeof obj.culture === "string") {
            voices.push({ name: obj.name, locale: obj.culture });
          }
        } catch {
          // 行単位 JSON でない出力は無視
        }
      }
      voices.sort((a, b) => {
        const aJa = a.locale.toLowerCase().startsWith("ja") ? 0 : 1;
        const bJa = b.locale.toLowerCase().startsWith("ja") ? 0 : 1;
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

/** Kokoro voice 名から大まかな言語ラベルを推定（先頭2文字: af/am/bf/bm/jf/jm/zf/zm 等）。 */
function kokoroVoiceLocale(name: string): string {
  const prefix = name.slice(0, 2).toLowerCase();
  switch (prefix) {
    case "jf":
    case "jm":
      return "ja";
    case "af":
    case "am":
      return "en-US";
    case "bf":
    case "bm":
      return "en-GB";
    case "zf":
    case "zm":
      return "zh";
    case "ef":
    case "em":
      return "es";
    case "ff":
    case "fm":
      return "fr";
    case "hf":
    case "hm":
      return "hi";
    case "if":
    case "im":
      return "it";
    case "pf":
    case "pm":
      return "pt-BR";
    default:
      return "?";
  }
}

export type KokoroVoiceOption = { name: string; locale: string };

async function fetchKokoroVoicesFromUrl(url: string): Promise<KokoroVoiceOption[]> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/v1/audio/voices`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    let names: string[] = [];
    if (Array.isArray(body)) {
      names = body.filter((v): v is string => typeof v === "string");
    } else if (body && typeof body === "object") {
      const v = (body as { voices?: unknown }).voices;
      if (Array.isArray(v)) {
        names = v.filter((x): x is string => typeof x === "string");
      }
    }
    const voices = names.map((name) => ({ name, locale: kokoroVoiceLocale(name) }));
    voices.sort((a, b) => {
      const order = (l: string) =>
        l === "ja" ? 0 : l.startsWith("en") ? 1 : l === "?" ? 9 : 2;
      const oa = order(a.locale);
      const ob = order(b.locale);
      if (oa !== ob) return oa - ob;
      return a.locale.localeCompare(b.locale) || a.name.localeCompare(b.name);
    });
    return voices;
  } catch {
    return [];
  }
}

export const fetchKokoroVoicesFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ url: z.string().url() }).optional())
  .handler(async ({ data }): Promise<KokoroVoiceOption[]> => {
    const cfg = await getConfig();
    const url = data?.url ?? cfg.kokoroUrl;
    return fetchKokoroVoicesFromUrl(url);
  });

export type EngineHealth = {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  error?: string;
};

/** VOICEVOX 互換 /speakers のレスポンス形を検証。 */
function isVoicevoxSpeakers(body: unknown): boolean {
  if (!Array.isArray(body) || body.length === 0) return false;
  const first = body[0] as Record<string, unknown> | null;
  if (!first || typeof first !== "object") return false;
  if (typeof first.name !== "string") return false;
  if (!Array.isArray(first.styles)) return false;
  return true;
}

/** Kokoro-FastAPI /v1/audio/voices のレスポンス形を検証（配列 or {voices: []}）。 */
function isKokoroVoices(body: unknown): boolean {
  if (Array.isArray(body)) return body.length > 0 && typeof body[0] === "string";
  if (body && typeof body === "object") {
    const v = (body as { voices?: unknown }).voices;
    if (Array.isArray(v) && v.length > 0) return true;
  }
  return false;
}

const HEALTH_CHECK: Record<
  "voicevox" | "aivisspeech" | "kokoro",
  { path: string; validate: (body: unknown) => boolean }
> = {
  voicevox: { path: "/speakers", validate: isVoicevoxSpeakers },
  aivisspeech: { path: "/speakers", validate: isVoicevoxSpeakers },
  kokoro: { path: "/v1/audio/voices", validate: isKokoroVoices },
};

export const checkEngineHealthFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.enum(["voicevox", "aivisspeech", "kokoro"]),
      url: z.string().url(),
    }),
  )
  .handler(async ({ data }): Promise<EngineHealth> => {
    const { path, validate } = HEALTH_CHECK[data.id];
    const target = `${data.url.replace(/\/$/, "")}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const start = Date.now();
    try {
      const res = await fetch(target, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return { ok: false, status: res.status, latencyMs };
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return {
          ok: false,
          status: res.status,
          latencyMs,
          error: "JSON parse 失敗 — 別サービスの可能性",
        };
      }
      if (!validate(body)) {
        return {
          ok: false,
          status: res.status,
          latencyMs,
          error: "想定外のレスポンス形 — 別サービスの可能性",
        };
      }
      return { ok: true, status: res.status, latencyMs };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  });
