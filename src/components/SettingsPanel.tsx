import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LLM_IDS, TTS_IDS, type Config, type LlmId, type TtsId } from "@/config.shared";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SourceCategorySchema,
  type SourceCategory,
} from "@/lib/news/types";
import {
  createProfileFn,
  deleteProfileFn,
  fetchAivisSpeakersFn,
  fetchSayVoicesFn,
  fetchSpeakersFn,
  listProfilesFn,
  listSourcesFn,
  loadConfigFn,
  loadProfileConfigFn,
  renameProfileFn,
  setActiveProfileFn,
  updateConfigFn,
  type ProfilesState,
  type SayVoiceOption,
  type SourceOption,
  type SpeakerOption,
} from "@/server/settings";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Props = {
  onClose?: () => void;
};

const AUTOSAVE_DEBOUNCE_MS = 400;

export function SettingsPanel({ onClose }: Props) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [profiles, setProfiles] = useState<ProfilesState | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [aivisSpeakers, setAivisSpeakers] = useState<SpeakerOption[]>([]);
  const [sayVoices, setSayVoices] = useState<SayVoiceOption[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // 編集中プロファイル（保存先）の id。profiles.activeProfileId と通常一致するが、
  // 切替直後にロード完了するまでズレるので別管理。
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
      listSourcesFn(),
    ]).then(([c, pf, sp, asp, sv, src]) => {
      if (cancelled) return;
      setCfg(c);
      setProfiles(pf);
      editingProfileIdRef.current = pf.activeProfileId;
      setSpeakers(sp);
      setAivisSpeakers(asp);
      setSayVoices(sv);
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
      // 進行中の保存があれば終わるのを待つ
      if (inflightSaveRef.current) await inflightSaveRef.current;
      return;
    }
    setStatus({ kind: "saving" });
    const p = (async () => {
      const res = await updateConfigFn({ data: { profileId, patch } });
      if (res.status === "ok") {
        setStatus({ kind: "saved" });
        setTimeout(
          () =>
            setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s)),
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

  // アンマウント時に保存し漏れがないよう flush。
  useEffect(() => {
    return () => {
      // 同期版: pending を即発火するため timer をクリアして flush。
      // unmount 後の state setter は no-op なので問題ない。
      void flushSave();
    };
  }, [flushSave]);

  const update = <K extends keyof Config>(key: K, value: Config[K]) => {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
    scheduleSave({ [key]: value } as Partial<Config>);
  };

  const sourcesByCategory = useMemo(() => {
    const map: Record<SourceCategory, SourceOption[]> = {
      japanese: [],
      tech: [],
      overseas: [],
      hatena: [],
    };
    for (const s of sources) {
      const cat = SourceCategorySchema.safeParse(s.category);
      if (cat.success) map[cat.data].push(s);
    }
    return map;
  }, [sources]);

  const enabledSet = useMemo(
    () => new Set(cfg?.enabledSources ?? sources.map((s) => s.id)),
    [cfg?.enabledSources, sources],
  );
  const isAllEnabled = cfg?.enabledSources === null;

  if (!cfg) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#8a93b8" }}>
        読み込み中...
      </div>
    );
  }

  const setEnabledSources = (next: Set<string>) => {
    if (next.size === sources.length) {
      update("enabledSources", null);
    } else {
      update(
        "enabledSources",
        sources.filter((s) => next.has(s.id)).map((s) => s.id),
      );
    }
  };

  const toggleSource = (id: string) => {
    const next = new Set(enabledSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabledSources(next);
  };

  const toggleCategory = (cat: SourceCategory) => {
    const inCat = sourcesByCategory[cat].map((s) => s.id);
    const allOn = inCat.every((id) => enabledSet.has(id));
    const next = new Set(enabledSet);
    if (allOn) for (const id of inCat) next.delete(id);
    else for (const id of inCat) next.add(id);
    setEnabledSources(next);
  };

  const resetSources = () => update("enabledSources", null);

  const selectLlm = (id: LlmId) => update("selectedLlm", id);
  const selectTts = (id: TtsId) => update("selectedTts", id);

  const switchProfile = async (id: string) => {
    if (!profiles || id === profiles.activeProfileId) return;
    // 進行中の保存・debounce を全部編集中プロファイルへ流し切ってから切り替える。
    await flushSave();
    editingProfileIdRef.current = id;
    const res = await setActiveProfileFn({ data: { id } });
    if (res.status !== "ok") {
      setStatus({ kind: "error", message: res.message });
      return;
    }
    setProfiles(res.state);
    const nextCfg = await loadProfileConfigFn({ data: { id } });
    if (nextCfg) setCfg(nextCfg);
  };

  const refreshProfiles = (state: ProfilesState) => {
    setProfiles(state);
  };

  const createNewProfile = async (fromActive: boolean) => {
    if (!profiles) return;
    const name = window.prompt(
      fromActive ? "複製したプロファイルの名前" : "新しいプロファイルの名前",
      "",
    );
    if (!name || !name.trim()) return;
    await flushSave();
    const res = await createProfileFn({
      data: {
        name: name.trim(),
        fromId: fromActive ? profiles.activeProfileId : undefined,
      },
    });
    if (res.status !== "ok") {
      setStatus({ kind: "error", message: res.message });
      return;
    }
    refreshProfiles(res.state);
    // 作成したプロファイルへすぐ切り替える（追加→ active が直感的）。
    const created = res.state.profiles.find(
      (p) =>
        p.name === name.trim() &&
        !profiles.profiles.some((existing) => existing.id === p.id),
    );
    if (created) await switchProfile(created.id);
  };

  const renameActiveProfile = async () => {
    if (!profiles) return;
    const current = profiles.profiles.find(
      (p) => p.id === profiles.activeProfileId,
    );
    const name = window.prompt("プロファイル名を変更", current?.name ?? "");
    if (!name || !name.trim() || name.trim() === current?.name) return;
    const res = await renameProfileFn({
      data: { id: profiles.activeProfileId, name: name.trim() },
    });
    if (res.status !== "ok") {
      setStatus({ kind: "error", message: res.message });
      return;
    }
    refreshProfiles(res.state);
  };

  const deleteActiveProfile = async () => {
    if (!profiles) return;
    if (profiles.profiles.length <= 1) return;
    const current = profiles.profiles.find(
      (p) => p.id === profiles.activeProfileId,
    );
    if (
      !window.confirm(
        `プロファイル「${current?.name ?? profiles.activeProfileId}」を削除します。よろしいですか？`,
      )
    )
      return;
    // pending な編集は捨てる（消すプロファイル宛なので意味がない）。
    pendingPatchRef.current = {};
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const res = await deleteProfileFn({
      data: { id: profiles.activeProfileId },
    });
    if (res.status !== "ok") {
      setStatus({ kind: "error", message: res.message });
      return;
    }
    refreshProfiles(res.state);
    editingProfileIdRef.current = res.state.activeProfileId;
    const nextCfg = await loadProfileConfigFn({
      data: { id: res.state.activeProfileId },
    });
    if (nextCfg) setCfg(nextCfg);
  };

  const refreshSpeakers = async () => {
    const list = await fetchSpeakersFn();
    setSpeakers(list);
  };

  const refreshAivisSpeakers = async () => {
    const list = await fetchAivisSpeakersFn({ data: { url: cfg.aivisSpeechUrl } });
    setAivisSpeakers(list);
  };

  const refreshSayVoices = async () => {
    const list = await fetchSayVoicesFn();
    setSayVoices(list);
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

      {profiles && (
        <section style={cardStyle}>
          <h2 style={sectionStyle}>プロファイル</h2>
          <Field
            label="使用中のプロファイル"
            hint="フィールドを編集すると自動で保存されます。プロファイルを切り替えると、設定全体が入れ替わります。"
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={profiles.activeProfileId}
                onChange={(e) => {
                  void switchProfile(e.target.value);
                }}
                style={{ ...inputStyle, flex: "1 1 200px" }}
              >
                {profiles.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void createNewProfile(false)}
                style={btnStyle()}
              >
                新規
              </button>
              <button
                type="button"
                onClick={() => void createNewProfile(true)}
                style={btnStyle()}
              >
                複製
              </button>
              <button
                type="button"
                onClick={() => void renameActiveProfile()}
                style={btnStyle()}
              >
                リネーム
              </button>
              <button
                type="button"
                onClick={() => void deleteActiveProfile()}
                disabled={profiles.profiles.length <= 1}
                style={{
                  ...btnStyle(),
                  opacity: profiles.profiles.length <= 1 ? 0.4 : 1,
                }}
              >
                削除
              </button>
            </div>
          </Field>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={sectionStyle}>LLM</h2>

        <Field
          label="使用する LLM"
          hint="API キーは環境変数で設定してください。"
        >
          <div style={{ display: "grid", gap: 6 }}>
            {LLM_IDS.map((id) => (
              <label key={id} style={sourceItemStyle}>
                <input
                  type="radio"
                  name="selectedLlm"
                  checked={cfg.selectedLlm === id}
                  onChange={() => selectLlm(id)}
                />
                <span style={{ fontSize: 13, color: "#cbd2ee" }}>
                  {LLM_LABELS[id]}
                </span>
              </label>
            ))}
          </div>
        </Field>

        {cfg.selectedLlm === "anthropic" && (
          <Field label="Anthropic モデル" hint="API キー: ANTHROPIC_API_KEY / 候補は目安・自由入力可">
            <input
              type="text"
              list="anthropic-models"
              value={cfg.anthropicModel}
              onChange={(e) => update("anthropicModel", e.target.value)}
              style={inputStyle}
            />
            <datalist id="anthropic-models">
              {ANTHROPIC_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        )}

        {cfg.selectedLlm === "openai" && (
          <Field label="OpenAI モデル" hint="API キー: OPENAI_API_KEY / 候補は目安・自由入力可">
            <input
              type="text"
              list="openai-models"
              value={cfg.openaiModel}
              onChange={(e) => update("openaiModel", e.target.value)}
              style={inputStyle}
            />
            <datalist id="openai-models">
              {OPENAI_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        )}

        {cfg.selectedLlm === "gemini" && (
          <Field label="Gemini モデル" hint="API キー: GEMINI_API_KEY / 候補は目安・自由入力可">
            <input
              type="text"
              list="gemini-models"
              value={cfg.geminiModel}
              onChange={(e) => update("geminiModel", e.target.value)}
              style={inputStyle}
            />
            <datalist id="gemini-models">
              {GEMINI_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        )}

        {cfg.selectedLlm === "ollama" && (
          <>
            <Field
              label="Ollama URL"
              hint="OpenAI 互換エンドポイント (/v1/chat/completions) を使用"
            >
              <input
                type="url"
                value={cfg.ollamaUrl}
                onChange={(e) => update("ollamaUrl", e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Ollama モデル" hint="ローカルに pull 済みのモデル名を入力（候補はあくまで参考）">
              <input
                type="text"
                list="ollama-models"
                value={cfg.ollamaModel}
                onChange={(e) => update("ollamaModel", e.target.value)}
                style={inputStyle}
              />
              <datalist id="ollama-models">
                {OLLAMA_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
          </>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionStyle}>音声合成</h2>

        <Field label="使用するエンジン">
          <div style={{ display: "grid", gap: 6 }}>
            {TTS_IDS.map((id) => (
              <label key={id} style={sourceItemStyle}>
                <input
                  type="radio"
                  name="selectedTts"
                  checked={cfg.selectedTts === id}
                  onChange={() => selectTts(id)}
                />
                <span style={{ fontSize: 13, color: "#cbd2ee" }}>
                  {TTS_LABELS[id]}
                </span>
              </label>
            ))}
          </div>
        </Field>

        {cfg.selectedTts === "voicevox" && (
          <>
            <Field label="VOICEVOX URL">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="url"
                  value={cfg.voicevoxUrl}
                  onChange={(e) => update("voicevoxUrl", e.target.value)}
                  style={inputStyle}
                />
                <button type="button" onClick={refreshSpeakers} style={btnStyle()}>
                  話者を再取得
                </button>
              </div>
            </Field>

            <Field
              label="話者"
              hint={
                speakers.length === 0
                  ? "VOICEVOX に接続できない場合は ID を直接入力"
                  : undefined
              }
            >
              {speakers.length > 0 ? (
                <select
                  value={cfg.voicevoxSpeaker}
                  onChange={(e) =>
                    update("voicevoxSpeaker", Number(e.target.value))
                  }
                  style={inputStyle}
                >
                  {speakers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} (id: {s.id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={cfg.voicevoxSpeaker}
                  onChange={(e) =>
                    update("voicevoxSpeaker", Number(e.target.value))
                  }
                  style={inputStyle}
                />
              )}
            </Field>
          </>
        )}

        {cfg.selectedTts === "aivisspeech" && (
          <>
            <Field label="AivisSpeech URL" hint="既定ポートは 10101">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="url"
                  value={cfg.aivisSpeechUrl}
                  onChange={(e) => update("aivisSpeechUrl", e.target.value)}
                  style={inputStyle}
                />
                <button type="button" onClick={refreshAivisSpeakers} style={btnStyle()}>
                  話者を再取得
                </button>
              </div>
            </Field>

            <Field
              label="話者"
              hint={
                aivisSpeakers.length === 0
                  ? "AivisSpeech に接続できない場合は ID を直接入力"
                  : undefined
              }
            >
              {aivisSpeakers.length > 0 ? (
                <select
                  value={cfg.aivisSpeechSpeaker}
                  onChange={(e) =>
                    update("aivisSpeechSpeaker", Number(e.target.value))
                  }
                  style={inputStyle}
                >
                  {aivisSpeakers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} (id: {s.id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={cfg.aivisSpeechSpeaker}
                  onChange={(e) =>
                    update("aivisSpeechSpeaker", Number(e.target.value))
                  }
                  style={inputStyle}
                />
              )}
            </Field>
          </>
        )}

        {cfg.selectedTts === "openai" && (
          <>
            <Field
              label="OpenAI TTS モデル"
              hint="API キー: OPENAI_API_KEY / 候補は目安・自由入力可"
            >
              <input
                type="text"
                list="openai-tts-models"
                value={cfg.openaiTtsModel}
                onChange={(e) => update("openaiTtsModel", e.target.value)}
                style={inputStyle}
              />
              <datalist id="openai-tts-models">
                {OPENAI_TTS_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Voice">
              <input
                type="text"
                list="openai-tts-voices"
                value={cfg.openaiTtsVoice}
                onChange={(e) => update("openaiTtsVoice", e.target.value)}
                style={inputStyle}
              />
              <datalist id="openai-tts-voices">
                {OPENAI_TTS_VOICES.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </Field>
          </>
        )}

        {cfg.selectedTts === "elevenlabs" && (
          <>
            <Field
              label="ElevenLabs モデル"
              hint="API キー: ELEVENLABS_API_KEY / 候補は目安・自由入力可"
            >
              <input
                type="text"
                list="elevenlabs-models"
                value={cfg.elevenlabsModelId}
                onChange={(e) => update("elevenlabsModelId", e.target.value)}
                style={inputStyle}
              />
              <datalist id="elevenlabs-models">
                {ELEVENLABS_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field
              label="Voice ID"
              hint="ElevenLabs ダッシュボードの Voice Library で確認した ID"
            >
              <input
                type="text"
                value={cfg.elevenlabsVoiceId}
                onChange={(e) => update("elevenlabsVoiceId", e.target.value)}
                placeholder="21m00Tcm4TlvDq8ikWAM"
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {cfg.selectedTts === "piper" && (
          <>
            <Field
              label="Piper バイナリ"
              hint="PATH が通っていれば 'piper' のままで OK。フルパスも可。"
            >
              <input
                type="text"
                value={cfg.piperBin}
                onChange={(e) => update("piperBin", e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field
              label="Voice model (.onnx) のパス"
              hint="huggingface.co/rhasspy/piper-voices などから取得した .onnx を絶対パスで指定"
            >
              <input
                type="text"
                value={cfg.piperModelPath}
                onChange={(e) => update("piperModelPath", e.target.value)}
                placeholder="/path/to/ja_JP-voice.onnx"
                style={inputStyle}
              />
            </Field>
            <Field
              label="Speaker ID (任意)"
              hint="multi-speaker モデルの場合のみ指定"
            >
              <input
                type="number"
                value={cfg.piperSpeakerId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update(
                    "piperSpeakerId",
                    v === "" ? undefined : Number(v),
                  );
                }}
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {cfg.selectedTts === "say" && (
          <>
            <Field
              label="Voice"
              hint={
                sayVoices.length === 0
                  ? "macOS 以外、または say コマンドが利用できない可能性があります"
                  : "ja_JP の voice (Kyoko / Otoya 等) を選ぶと日本語が自然に発話されます"
              }
            >
              <div style={{ display: "flex", gap: 8 }}>
                {sayVoices.length > 0 ? (
                  <select
                    value={cfg.sayVoice}
                    onChange={(e) => update("sayVoice", e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">(システム既定)</option>
                    {sayVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.locale})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={cfg.sayVoice}
                    onChange={(e) => update("sayVoice", e.target.value)}
                    placeholder="Kyoko"
                    style={inputStyle}
                  />
                )}
                <button type="button" onClick={refreshSayVoices} style={btnStyle()}>
                  再取得
                </button>
              </div>
            </Field>

            <Field label="発話速度 (words/min)" hint="既定 180。大きいほど速く読み上げます。">
              <input
                type="number"
                min={50}
                max={500}
                value={cfg.sayRate}
                onChange={(e) => update("sayRate", Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
          </>
        )}

        <Field
          label="並列合成数"
          hint="段落単位の合成を何並列で走らせるか (1 で逐次)。大きくすると速くなる代わりに VOICEVOX/AivisSpeech などローカルエンジンの CPU 負荷が上がる。"
        >
          <input
            type="number"
            min={1}
            max={8}
            value={cfg.ttsConcurrency}
            onChange={(e) => update("ttsConcurrency", Number(e.target.value))}
            style={inputStyle}
          />
        </Field>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <h2 style={{ ...sectionStyle, marginBottom: 0 }}>ニュースソース</h2>
          <button
            type="button"
            onClick={resetSources}
            disabled={isAllEnabled}
            style={{ ...btnStyle(), opacity: isAllEnabled ? 0.4 : 1 }}
          >
            全件に戻す
          </button>
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const list = sourcesByCategory[cat];
          if (list.length === 0) return null;
          const onCount = list.filter((s) => enabledSet.has(s.id)).length;
          const allOn = onCount === list.length;
          const someOn = onCount > 0 && onCount < list.length;
          return (
            <div key={cat} style={{ marginBottom: 18 }}>
              <label style={categoryLabelStyle}>
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = someOn;
                  }}
                  onChange={() => toggleCategory(cat)}
                />
                <span style={{ color: "#cbd2ee", fontSize: 14 }}>
                  {CATEGORY_LABELS[cat]}
                </span>
                <span style={{ color: "#5a6188", fontSize: 12 }}>
                  ({onCount}/{list.length})
                </span>
              </label>
              <div style={sourceGroupStyle}>
                {list.map((s) => (
                  <label key={s.id} style={sourceItemStyle}>
                    <input
                      type="checkbox"
                      checked={enabledSet.has(s.id)}
                      onChange={() => toggleSource(s.id)}
                    />
                    <span style={{ fontSize: 13, color: "#cbd2ee" }}>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {enabledSet.size === 0 && (
          <div style={{ fontSize: 12, color: "#ffb8c0", marginTop: 8 }}>
            すべてのソースが OFF です。番組生成は空結果となり、次の番組は作られません。
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{ ...btnStyle(), background: "transparent", border: "none", color: "#8a93b8" }}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: "#8a93b8", marginBottom: 6 }}>{label}</div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "#5a6188", marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

const LLM_LABELS: Record<LlmId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  ollama: "Ollama (ローカル)",
};

const TTS_LABELS: Record<TtsId, string> = {
  voicevox: "VOICEVOX",
  aivisspeech: "AivisSpeech",
  say: "macOS say",
  openai: "OpenAI TTS",
  elevenlabs: "ElevenLabs",
  piper: "Piper (ローカル)",
};

const OPENAI_TTS_MODELS = [
  "gpt-4o-mini-tts",
  "tts-1",
  "tts-1-hd",
] as const;

const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

const ELEVENLABS_MODELS = [
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
] as const;

// 安い順に列挙（2026-05 時点・公式公開価格ベース）
const ANTHROPIC_MODELS = [
  "claude-haiku-4-5", // $1 / $5 (cheapest current)
  "claude-sonnet-4-6", // $3 / $15
  "claude-opus-4-7", // $5 / $25
] as const;

const OPENAI_MODELS = [
  "gpt-4.1-nano", // $0.10 / $0.40 (cheapest)
  "gpt-4o-mini", // $0.15 / $0.60
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o",
] as const;

const GEMINI_MODELS = [
  "gemini-2.5-flash-lite", // $0.10 / $0.40 (cheapest)
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
] as const;

// ローカル実行（無料）。軽量・日本語要約向けを上から
const OLLAMA_MODELS = [
  "qwen2.5:3b-instruct", // 軽量 + 日本語OK
  "qwen2.5:7b-instruct",
  "llama3.2:3b",
  "phi3:mini",
  "mistral:7b",
  "llama3.1:8b",
] as const;

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.4em",
  color: "#8a93b8",
  marginBottom: 8,
};

const cardStyle: React.CSSProperties = {
  width: "min(640px, 100%)",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: "28px",
};

const sectionStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.3em",
  color: "#8a93b8",
  marginBottom: 18,
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e6e9f5",
  fontSize: 14,
  fontFamily: "inherit",
};

const categoryLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  paddingBottom: 8,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const sourceGroupStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 6,
  paddingTop: 10,
  paddingLeft: 24,
};

const sourceItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  padding: "4px 0",
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  fontSize: 24,
  lineHeight: 1,
  color: "#8a93b8",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 8,
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 999,
    background: active ? "rgba(255,122,138,0.15)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "#ff7a8a" : "rgba(255,255,255,0.1)"}`,
    color: active ? "#ff7a8a" : "#cbd2ee",
    fontSize: 13,
    cursor: "pointer",
    textTransform: "capitalize",
  };
}

function btnStyle(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e6e9f5",
    fontSize: 13,
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
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
