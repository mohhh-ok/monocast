import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { Config } from "@/config";
import { CATEGORY_LABELS, CATEGORY_ORDER, type SourceCategory } from "@/lib/news";
import {
  fetchSpeakersFn,
  listSourcesFn,
  loadConfigFn,
  updateConfigFn,
  type SourceOption,
  type SpeakerOption,
} from "@/server/settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  loader: async () => {
    const [cfg, speakers, sources] = await Promise.all([
      loadConfigFn(),
      fetchSpeakersFn(),
      listSourcesFn(),
    ]);
    return { cfg, speakers, sources };
  },
});

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

function SettingsPage() {
  const initial = Route.useLoaderData();
  const [cfg, setCfg] = useState<Config>(initial.cfg);
  const [speakers, setSpeakers] = useState<SpeakerOption[]>(initial.speakers);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const sources = initial.sources;

  const update = <K extends keyof Config>(key: K, value: Config[K]) => {
    setCfg({ ...cfg, [key]: value });
  };

  const sourcesByCategory = useMemo(() => {
    const map: Record<SourceCategory, SourceOption[]> = {
      domestic: [],
      tech: [],
      overseas: [],
      hatena: [],
    };
    for (const s of sources) map[s.category].push(s);
    return map;
  }, [sources]);

  // null = 全件有効。表示時は「全 ID 選択」として扱う。
  const enabledSet = useMemo(
    () => new Set(cfg.enabledSources ?? sources.map((s) => s.id)),
    [cfg.enabledSources, sources],
  );
  const isAllEnabled = cfg.enabledSources === null;

  const setEnabledSources = (next: Set<string>) => {
    // 全件に戻った場合は null に正規化する（「未設定」表現を保つ）
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

  const onSave = async () => {
    setStatus({ kind: "saving" });
    const res = await updateConfigFn({ data: cfg });
    if (res.status === "ok") {
      setCfg(res.config);
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus({ kind: "idle" }), 1500);
    } else {
      setStatus({ kind: "error", message: res.message });
    }
  };

  const refreshSpeakers = async () => {
    const list = await fetchSpeakersFn();
    setSpeakers(list);
  };

  return (
    <main style={mainStyle}>
      <header style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={eyebrowStyle}>SETTINGS · MONOCAST</div>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "#cbd2ee" }}>設定</h1>
      </header>

      <section style={cardStyle}>
        <h2 style={sectionStyle}>LLM</h2>

        <Field label="プロバイダ">
          <div style={{ display: "flex", gap: 8 }}>
            {(["anthropic", "ollama"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update("llmProvider", p)}
                style={pillStyle(cfg.llmProvider === p)}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        {cfg.llmProvider === "anthropic" ? (
          <Field label="Anthropic モデル" hint="API キーは環境変数 ANTHROPIC_API_KEY で設定">
            <input
              type="text"
              value={cfg.anthropicModel}
              onChange={(e) => update("anthropicModel", e.target.value)}
              style={inputStyle}
            />
          </Field>
        ) : (
          <>
            <Field label="Ollama URL">
              <input
                type="url"
                value={cfg.ollamaUrl}
                onChange={(e) => update("ollamaUrl", e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Ollama モデル">
              <input
                type="text"
                value={cfg.ollamaModel}
                onChange={(e) => update("ollamaModel", e.target.value)}
                style={inputStyle}
              />
            </Field>
          </>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionStyle}>音声合成 (VOICEVOX)</h2>

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
          hint={speakers.length === 0 ? "VOICEVOX に接続できない場合は ID を直接入力" : undefined}
        >
          {speakers.length > 0 ? (
            <select
              value={cfg.voicevoxSpeaker}
              onChange={(e) => update("voicevoxSpeaker", Number(e.target.value))}
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
              onChange={(e) => update("voicevoxSpeaker", Number(e.target.value))}
              style={inputStyle}
            />
          )}
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
            すべてのソースが OFF です。番組生成は失敗します。
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          onClick={onSave}
          disabled={status.kind === "saving"}
          style={primaryBtnStyle(status.kind === "saving")}
        >
          {status.kind === "saving" ? "保存中..." : "保存"}
        </button>
        <Link to="/" style={{ color: "#8a93b8", fontSize: 13 }}>
          ← トップへ戻る
        </Link>
        {status.kind === "saved" && (
          <span style={{ color: "#8aff9d", fontSize: 13 }}>保存しました</span>
        )}
        {status.kind === "error" && (
          <span style={{ color: "#ffb8c0", fontSize: 13 }}>{status.message}</span>
        )}
      </div>
    </main>
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

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "48px 24px 96px",
  gap: 24,
};

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

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 24px",
    borderRadius: 999,
    background: "rgba(255,122,138,0.15)",
    border: "1px solid #ff7a8a",
    color: "#ff7a8a",
    fontSize: 14,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer",
  };
}
