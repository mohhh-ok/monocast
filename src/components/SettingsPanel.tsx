import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Config } from "@/config.shared";
import {
  fetchAivisSpeakersFn,
  fetchKokoroVoicesFn,
  fetchSapiVoicesFn,
  fetchSayVoicesFn,
  fetchSpeakersFn,
  listProfilesFn,
  listSourcesFn,
  loadConfigFn,
  renameProfileFn,
  updateConfigFn,
  type KokoroVoiceOption,
  type ProfilesState,
  type SapiVoiceOption,
  type SayVoiceOption,
  type SourceOption,
  type SpeakerOption,
} from "@/server/settings";
import { LlmSection } from "./settings/LlmSection";
import { NewsSourcesSection } from "./settings/NewsSourcesSection";
import { ProfileSection } from "./settings/ProfileSection";
import { TtsSection } from "./settings/TtsSection";
import { btnStyle, closeBtnStyle, eyebrowStyle } from "./settings/styles";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Props = {
  onClose?: () => void;
  onProfilesChange?: (state: ProfilesState) => void;
};

const AUTOSAVE_DEBOUNCE_MS = 400;

export function SettingsPanel({ onClose, onProfilesChange }: Props) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [aivisSpeakers, setAivisSpeakers] = useState<SpeakerOption[]>([]);
  const [sayVoices, setSayVoices] = useState<SayVoiceOption[]>([]);
  const [sapiVoices, setSapiVoices] = useState<SapiVoiceOption[]>([]);
  const [kokoroVoices, setKokoroVoices] = useState<KokoroVoiceOption[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // 編集中プロファイル（保存先）の id。表に出した切替 UI から書き換わる可能性に備えて
  // マウント時にスナップショットを取り、autosave はこの id 宛で保存する。
  const editingProfileIdRef = useRef<string | null>(null);
  // debounce タイマーと、進行中の保存 Promise（切替時に await するため）。
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightSaveRef = useRef<Promise<unknown> | null>(null);
  // 直近で要求された patch（debounce の間に複数フィールド変わった場合をマージする）。
  const pendingPatchRef = useRef<Partial<Config>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadConfigFn(),
      listProfilesFn(),
      fetchSpeakersFn(),
      fetchAivisSpeakersFn(),
      fetchSayVoicesFn(),
      fetchSapiVoicesFn(),
      fetchKokoroVoicesFn(),
      listSourcesFn(),
    ]).then(([c, pf, sp, asp, sv, sapi, kv, src]) => {
      if (cancelled) return;
      setCfg(c);
      editingProfileIdRef.current = pf.activeProfileId;
      const active = pf.profiles.find((p) => p.id === pf.activeProfileId);
      setProfileName(active?.name ?? "");
      setSpeakers(sp);
      setAivisSpeakers(asp);
      setSayVoices(sv);
      setSapiVoices(sapi);
      setKokoroVoices(kv);
      setSources(src);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const flushSave = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    const profileId = editingProfileIdRef.current;
    if (!profileId || Object.keys(patch).length === 0) {
      if (inflightSaveRef.current) await inflightSaveRef.current;
      return;
    }
    setStatus({ kind: "saving" });
    const p = (async () => {
      const res = await updateConfigFn({ data: { profileId, patch } });
      if (res.status === "ok") {
        setStatus({ kind: "saved" });
        setTimeout(
          () => setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s)),
          1200,
        );
      } else {
        setStatus({ kind: "error", message: res.message });
      }
    })();
    inflightSaveRef.current = p;
    try {
      await p;
    } finally {
      if (inflightSaveRef.current === p) inflightSaveRef.current = null;
    }
  }, []);

  const scheduleSave = useCallback(
    (patch: Partial<Config>) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void flushSave();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  useEffect(() => {
    return () => {
      void flushSave();
    };
  }, [flushSave]);

  const update = useCallback(
    <K extends keyof Config>(key: K, value: Config[K]) => {
      setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
      scheduleSave({ [key]: value } as Partial<Config>);
    },
    [scheduleSave],
  );

  if (!cfg) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#8a93b8" }}>
        読み込み中...
      </div>
    );
  }

  const renameCurrentProfile = async () => {
    const id = editingProfileIdRef.current;
    if (!id) return;
    const name = window.prompt("プロファイル名を変更", profileName);
    if (!name || !name.trim() || name.trim() === profileName) return;
    const res = await renameProfileFn({ data: { id, name: name.trim() } });
    if (res.status !== "ok") {
      setStatus({ kind: "error", message: res.message });
      return;
    }
    const active = res.state.profiles.find((p) => p.id === id);
    setProfileName(active?.name ?? name.trim());
    onProfilesChange?.(res.state);
  };

  return (
    <>
      <header
        style={{ textAlign: "center", marginBottom: 8, position: "relative" }}
      >
        <div style={eyebrowStyle}>SETTINGS · MONOCAST</div>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "#cbd2ee" }}>設定</h1>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={closeBtnStyle}
          >
            ×
          </button>
        )}
      </header>

      <ProfileSection
        profileName={profileName}
        onRename={() => void renameCurrentProfile()}
      />

      <NewsSourcesSection
        sources={sources}
        enabledSources={cfg.enabledSources}
        onChange={(next) => update("enabledSources", next)}
      />

      <LlmSection cfg={cfg} update={update} />

      <TtsSection
        cfg={cfg}
        update={update}
        speakers={speakers}
        setSpeakers={setSpeakers}
        aivisSpeakers={aivisSpeakers}
        setAivisSpeakers={setAivisSpeakers}
        sayVoices={sayVoices}
        setSayVoices={setSayVoices}
        sapiVoices={sapiVoices}
        setSapiVoices={setSapiVoices}
        kokoroVoices={kokoroVoices}
        setKokoroVoices={setKokoroVoices}
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              ...btnStyle(),
              background: "transparent",
              border: "none",
              color: "#8a93b8",
            }}
          >
            閉じる
          </button>
        ) : (
          <Link to="/" style={{ color: "#8a93b8", fontSize: 13 }}>
            ← トップへ戻る
          </Link>
        )}
        <span style={{ fontSize: 12, color: statusColor(status) }}>
          {statusLabel(status)}
        </span>
      </div>
    </>
  );
}

function statusLabel(status: Status): string {
  switch (status.kind) {
    case "idle":
      return "自動保存が有効です";
    case "saving":
      return "保存中...";
    case "saved":
      return "保存しました";
    case "error":
      return `保存エラー: ${status.message}`;
  }
}

function statusColor(status: Status): string {
  switch (status.kind) {
    case "saved":
      return "#8aff9d";
    case "error":
      return "#ffb8c0";
    case "saving":
      return "#cbd2ee";
    default:
      return "#5a6188";
  }
}

