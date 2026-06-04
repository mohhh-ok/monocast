import { useEffect, useRef, useState } from "react";
import { checkEngineHealthFn } from "@/server/settings";
import { btnStyle } from "./styles";

type EngineId = "voicevox" | "aivisspeech" | "kokoro";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; latencyMs: number; url: string }
  | { kind: "down"; url?: string; error?: string };

type Props = {
  id: EngineId;
};

export function EngineStatus({ id }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // 直近のリクエストだけを反映するための世代カウンタ。
  const reqIdRef = useRef(0);

  const check = async () => {
    const my = ++reqIdRef.current;
    setState({ kind: "checking" });
    try {
      const r = await checkEngineHealthFn({ data: { id } });
      if (my !== reqIdRef.current) return;
      if (r.ok) setState({ kind: "ok", latencyMs: r.latencyMs ?? 0, url: r.url });
      else setState({ kind: "down", url: r.url, error: r.error });
    } catch (err) {
      if (my !== reqIdRef.current) return;
      setState({
        kind: "down",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const url = state.kind === "ok" || state.kind === "down" ? state.url : undefined;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <Badge state={state} />
      {url && (
        <span style={{ fontSize: 12, color: "#8a93b8" }}>{url}</span>
      )}
      <button type="button" onClick={check} style={smallBtnStyle()}>
        再チェック
      </button>
    </div>
  );
}

function Badge({ state }: { state: State }) {
  const { bg, fg, label } = (() => {
    switch (state.kind) {
      case "idle":
        return { bg: "rgba(255,255,255,0.06)", fg: "#8a93b8", label: "未確認" };
      case "checking":
        return { bg: "rgba(255,255,255,0.06)", fg: "#cbd2ee", label: "確認中…" };
      case "ok":
        return {
          bg: "rgba(74,222,128,0.12)",
          fg: "#86efac",
          label: `接続OK (${state.latencyMs}ms)`,
        };
      case "down":
        return {
          bg: "rgba(248,113,113,0.12)",
          fg: "#fca5a5",
          label: "未起動 / 接続失敗",
        };
    }
  })();
  return (
    <span
      title={state.kind === "down" ? state.error : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        background: bg,
        color: fg,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {label}
    </span>
  );
}

function smallBtnStyle() {
  return { ...btnStyle(), padding: "4px 10px", fontSize: 12 };
}
