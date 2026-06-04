import { promises as fs } from "node:fs";
import path from "node:path";
import { atomicWriteJson } from "./lib/atomic-json";
import { dataPath } from "./lib/data-dir";
import { createSerialQueue } from "./lib/serial";
import {
  ConfigSchema,
  DEDUP_MODES,
  DEFAULT_CONFIG,
  LLM_IDS,
  RANDOM_PROFILE_ID,
  TTS_IDS,
  type Config,
  type DedupMode,
  type LlmId,
  type TtsId,
} from "./config.shared";

export {
  ConfigSchema,
  DEDUP_MODES,
  DEFAULT_CONFIG,
  LLM_IDS,
  RANDOM_PROFILE_ID,
  TTS_IDS,
};
export type { Config, DedupMode, LlmId, TtsId };

// パスはモジュールロード時に固定せず、毎回 dataPath() で解決する
// （MONOCAST_DATA_DIR によるテスト時の差し替えを効かせるため）。
const rootFile = () => dataPath("config.json");
const profilesDir = () => dataPath("profiles");

const DEFAULT_PROFILE_ID = "default";
const DEFAULT_PROFILE_NAME = "default";

export type ProfileMeta = { id: string; name: string };
export type Profile = { id: string; name: string; config: Config };

type ProfileFile = { name: string; config: unknown };

const runExclusive = createSerialQueue();

function profilePath(id: string): string {
  return path.join(profilesDir(), `${id}.json`);
}

function isValidProfileId(id: string): boolean {
  if (id === RANDOM_PROFILE_ID) return false;
  return /^[A-Za-z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 64;
}

// 旧形式 (フラットな Config) かどうかを判定する。
function looksLikeFlatConfig(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.activeProfileId === "string") return false;
  return typeof v.selectedLlm === "string" || typeof v.selectedTts === "string";
}

async function readJsonIfExists(file: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
    throw err;
  }
}

async function migrateIfNeeded(): Promise<void> {
  const root = await readJsonIfExists(rootFile());
  // 既に新形式
  if (
    root &&
    typeof root === "object" &&
    typeof (root as Record<string, unknown>).activeProfileId === "string"
  ) {
    return;
  }
  // 旧フラット形式 → default プロファイルへ移動
  if (looksLikeFlatConfig(root)) {
    const cfg = ConfigSchema.parse(root);
    await fs.mkdir(profilesDir(), { recursive: true });
    const file = profilePath(DEFAULT_PROFILE_ID);
    // 既に default が居る場合は上書きしない
    try {
      await fs.access(file);
    } catch {
      await atomicWriteJson(file, {
        name: DEFAULT_PROFILE_NAME,
        config: cfg,
      } satisfies ProfileFile);
    }
    await atomicWriteJson(rootFile(), { activeProfileId: DEFAULT_PROFILE_ID });
    return;
  }
  // 何もない（初回起動）: default を作成
  await fs.mkdir(profilesDir(), { recursive: true });
  const file = profilePath(DEFAULT_PROFILE_ID);
  try {
    await fs.access(file);
  } catch {
    await atomicWriteJson(file, {
      name: DEFAULT_PROFILE_NAME,
      config: DEFAULT_CONFIG,
    } satisfies ProfileFile);
  }
  await atomicWriteJson(rootFile(), { activeProfileId: DEFAULT_PROFILE_ID });
}

let migrated = false;
async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  await migrateIfNeeded();
  migrated = true;
}

async function readProfileFile(id: string): Promise<Profile | null> {
  const raw = await readJsonIfExists(profilePath(id));
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const name = typeof v.name === "string" && v.name.trim() ? v.name : id;
  const parsed = ConfigSchema.safeParse(v.config);
  if (!parsed.success) return null;
  return { id, name, config: parsed.data };
}

async function writeProfileFile(profile: Profile): Promise<void> {
  await atomicWriteJson(profilePath(profile.id), {
    name: profile.name,
    config: profile.config,
  } satisfies ProfileFile);
}

async function readRoot(): Promise<{ activeProfileId: string }> {
  const raw = await readJsonIfExists(rootFile());
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as Record<string, unknown>).activeProfileId === "string"
  ) {
    return { activeProfileId: (raw as { activeProfileId: string }).activeProfileId };
  }
  return { activeProfileId: DEFAULT_PROFILE_ID };
}

async function writeRoot(activeProfileId: string): Promise<void> {
  await atomicWriteJson(rootFile(), { activeProfileId });
}

/** プロファイル一覧（id 昇順だが default は先頭）。 */
export async function listProfiles(): Promise<ProfileMeta[]> {
  await ensureMigrated();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(profilesDir());
  } catch {
    entries = [];
  }
  const metas: ProfileMeta[] = [];
  for (const f of entries) {
    if (!f.endsWith(".json")) continue;
    const id = f.replace(/\.json$/, "");
    if (!isValidProfileId(id)) continue;
    const p = await readProfileFile(id);
    if (p) metas.push({ id: p.id, name: p.name });
  }
  metas.sort((a, b) => {
    if (a.id === DEFAULT_PROFILE_ID && b.id !== DEFAULT_PROFILE_ID) return -1;
    if (b.id === DEFAULT_PROFILE_ID && a.id !== DEFAULT_PROFILE_ID) return 1;
    return a.name.localeCompare(b.name);
  });
  return metas;
}

/**
 * ランダム解決のための「セッション override」。
 * `withResolvedActiveProfile` で 1 度だけ抽選した実プロファイル id を保持し、
 * その間の `getActiveProfileId` / `getConfig` を一貫させる（番組生成中に
 * `getConfig` が複数回呼ばれても毎回違うプロファイルにならないようにする）。
 * 番組生成は同時に 1 本しか走らない前提なのでモジュールスコープで足りる。
 */
let sessionResolvedId: string | null = null;

export async function getActiveProfileId(): Promise<string> {
  if (sessionResolvedId) return sessionResolvedId;
  await ensureMigrated();
  const { activeProfileId } = await readRoot();
  // ランダム選択中はそのまま返す（fallback しない）
  if (activeProfileId === RANDOM_PROFILE_ID) return RANDOM_PROFILE_ID;
  // アクティブが消えていたら最初のプロファイルにフォールバック
  const file = await readProfileFile(activeProfileId);
  if (file) return activeProfileId;
  const list = await listProfiles();
  return list[0]?.id ?? DEFAULT_PROFILE_ID;
}

/** ランダム選択中なら実プロファイルに解決した id を返す。session override 優先。 */
export async function resolveActiveProfileId(): Promise<string> {
  if (sessionResolvedId) return sessionResolvedId;
  const id = await getActiveProfileId();
  if (id !== RANDOM_PROFILE_ID) return id;
  const list = await listProfiles();
  if (list.length === 0) return DEFAULT_PROFILE_ID;
  return list[Math.floor(Math.random() * list.length)].id;
}

/**
 * 1 セッション分だけランダムを解決して固定する。fn の中で呼ばれた `getConfig` /
 * `getActiveProfileId` は同じプロファイルを返す。
 */
export async function withResolvedActiveProfile<T>(
  fn: (profileId: string) => Promise<T>,
): Promise<T> {
  const id = await resolveActiveProfileId();
  const prev = sessionResolvedId;
  sessionResolvedId = id;
  try {
    return await fn(id);
  } finally {
    sessionResolvedId = prev;
  }
}

/** アクティブプロファイルの Config を返す。読めなければ DEFAULT_CONFIG。 */
export async function getConfig(): Promise<Config> {
  const id = await resolveActiveProfileId();
  const p = await readProfileFile(id);
  return p?.config ?? DEFAULT_CONFIG;
}

/**
 * 指定したプロファイル（省略時はアクティブ）に patch を当てて保存する。
 * 編集中にユーザーが他プロファイルへ切り替えた場合に書き込み先を取り違えないよう、
 * 呼び出し側は profileId を明示できる。
 */
export async function saveConfig(
  patch: Partial<Config>,
  profileId?: string,
): Promise<Config> {
  return runExclusive(async () => {
    await ensureMigrated();
    const id = profileId ?? (await getActiveProfileId());
    const current = await readProfileFile(id);
    if (!current) throw new Error("プロファイルが見つかりません");
    const next = ConfigSchema.parse({ ...current.config, ...patch });
    await writeProfileFile({ id, name: current.name, config: next });
    return next;
  });
}

/** 指定したプロファイルの Config を返す。読めなければ null。 */
export async function getProfileConfig(id: string): Promise<Config | null> {
  await ensureMigrated();
  const p = await readProfileFile(id);
  return p?.config ?? null;
}

function newProfileId(): string {
  // crypto.randomUUID は Node 20+ で利用可。"-" を含むため isValidProfileId と整合する。
  return globalThis.crypto?.randomUUID?.() ?? `p${Date.now().toString(36)}`;
}

export type CreateProfileInput = { name: string; fromId?: string };

export async function createProfile(input: CreateProfileInput): Promise<ProfileMeta> {
  return runExclusive(async () => {
    await ensureMigrated();
    const name = input.name.trim();
    if (!name) throw new Error("プロファイル名を入力してください");
    let base: Config = DEFAULT_CONFIG;
    if (input.fromId) {
      const src = await readProfileFile(input.fromId);
      if (!src) throw new Error("コピー元プロファイルが見つかりません");
      base = src.config;
    }
    const id = newProfileId();
    await writeProfileFile({ id, name, config: base });
    return { id, name };
  });
}

export async function renameProfile(id: string, name: string): Promise<ProfileMeta> {
  return runExclusive(async () => {
    await ensureMigrated();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("プロファイル名を入力してください");
    const current = await readProfileFile(id);
    if (!current) throw new Error("プロファイルが見つかりません");
    await writeProfileFile({ id, name: trimmed, config: current.config });
    return { id, name: trimmed };
  });
}

export async function deleteProfile(id: string): Promise<{ activeProfileId: string }> {
  return runExclusive(async () => {
    await ensureMigrated();
    const all = await listProfiles();
    if (all.length <= 1) throw new Error("最後のプロファイルは削除できません");
    if (!all.some((p) => p.id === id)) {
      throw new Error("プロファイルが見つかりません");
    }
    await fs.rm(profilePath(id), { force: true });
    const { activeProfileId } = await readRoot();
    let nextActive = activeProfileId;
    if (activeProfileId === id) {
      const remaining = await listProfiles();
      nextActive = remaining[0].id;
      await writeRoot(nextActive);
    }
    return { activeProfileId: nextActive };
  });
}

export async function setActiveProfile(id: string): Promise<void> {
  return runExclusive(async () => {
    await ensureMigrated();
    if (id !== RANDOM_PROFILE_ID) {
      const p = await readProfileFile(id);
      if (!p) throw new Error("プロファイルが見つかりません");
    }
    await writeRoot(id);
  });
}
