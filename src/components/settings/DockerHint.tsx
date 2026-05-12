import { useState } from "react";
import { btnStyle } from "./styles";

type Props = {
  /** 例: "voicevox" → docker compose --profile voicevox up -d を出す */
  profile: "voicevox" | "aivisspeech" | "kokoro";
};

export function DockerHint({ profile }: Props) {
  const command = `docker compose --profile ${profile} up -d`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // クリップボード API が使えない環境では諦める（select で代替してもよいが UX 軽視）
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          color: "#8a93b8",
          marginBottom: 4,
        }}
      >
        起動コマンド
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 8,
        }}
      >
        <code
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "#cbd2ee",
            fontSize: 12,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          {command}
        </code>
        <button type="button" onClick={copy} style={btnStyle()}>
          {copied ? "コピー済み" : "コピー"}
        </button>
      </div>
    </div>
  );
}
