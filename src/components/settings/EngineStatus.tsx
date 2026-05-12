import { useEffect, useRef, useState } from "react";
import { checkEngineHealthFn } from "@/server/settings";
import { btnStyle } from "./styles";

type EngineId = "voicevox" | "aivisspeech" | "kokoro";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; latencyMs: number }
  | { kind: "down"; error?: string };

type Props = {
  id: EngineId;
  url: string;
};

export function EngineStatus({ id, url }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // 直近のリクエストだけを反映するための世代カウンタ。
  const reqIdRef = useRef(0);

  const check = async () => {
    const my = ++reqIdRef.current;
    setState({ kind: "checking" });
    try {
      const r = await checkEngineHealthFn({ data: { id, url } });
      if (my !== reqIdRef.current) return;
      if (r.ok) setState({ kind: "ok", latencyMs: r.latencyMs ?? 0 });
      else setState({ kind: "down", error: r.error });
    } catch (err) {
      if (my !== reqIdRef.current) return;
      setState({
        kind: "down",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // URL 変更時に 500ms デバウンスして再チェック
  useEffect(() => {
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, url]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <Badge state={state} />
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
