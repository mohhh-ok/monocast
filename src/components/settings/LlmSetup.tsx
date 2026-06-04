import { useState, type ReactNode } from "react";
import type { LlmId } from "@/config.shared";
import { btnStyle } from "./styles";

type Step = {
  label: string;
  command?: string;
  link?: { href: string; text: string };
  note?: string;
};

const STEPS: Record<LlmId, Step[]> = {
  anthropic: [
    {
      label: "API キーを発行",
      link: {
        href: "https://console.anthropic.com/settings/keys",
        text: "console.anthropic.com",
      },
    },
    {
      label: "環境変数として設定",
      command: "export ANTHROPIC_API_KEY=sk-ant-...",
      note: ".env もしくはシェルに設定して再起動",
    },
  ],
  openai: [
    {
      label: "API キーを発行",
      link: {
        href: "https://platform.openai.com/api-keys",
        text: "platform.openai.com",
      },
    },
    {
      label: "環境変数として設定",
      command: "export OPENAI_API_KEY=sk-...",
      note: ".env もしくはシェルに設定して再起動",
    },
  ],
  gemini: [
    {
      label: "API キーを発行",
      link: {
        href: "https://aistudio.google.com/apikey",
        text: "aistudio.google.com",
      },
    },
    {
      label: "環境変数として設定",
      command: "export GEMINI_API_KEY=...",
      note: ".env もしくはシェルに設定して再起動",
    },
  ],
  ollama: [
    {
      label: "Ollama をインストール",
      command: "brew install ollama",
      link: { href: "https://ollama.com/download", text: "ollama.com/download" },
      note: "Apple Silicon の Metal GPU を使うのでネイティブ実行が高速",
    },
    {
      label: "サーバを起動",
      command: "ollama serve",
      note: "既定で http://localhost:11434 を listen（変える場合は .env.local の OLLAMA_URL）",
    },
    {
      label: "モデルを取得",
      command: "ollama pull qwen2.5:3b-instruct",
      link: { href: "https://ollama.com/library", text: "ollama.com/library" },
    },
  ],
};

export function LlmSetup({ id }: { id: LlmId }) {
  const steps = STEPS[id];
  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px",
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.2em",
          color: "#8a93b8",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        セットアップ
      </div>
      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          display: "grid",
          gap: 10,
          color: "#cbd2ee",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {steps.map((s, i) => (
          <li key={i}>
            <Line label={s.label} link={s.link} />
            {s.command && <CopyableCode command={s.command} />}
            {s.note && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#8a93b8" }}>
                {s.note}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Line({
  label,
  link,
}: {
  label: string;
  link?: { href: string; text: string };
}): ReactNode {
  return (
    <div style={{ marginBottom: 6 }}>
      <span>{label}</span>
      {link && (
        <>
          <span style={{ color: "#8a93b8" }}> — </span>
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: "#9bb1ff", textDecoration: "underline" }}
          >
            {link.text}
          </a>
        </>
      )}
    </div>
  );
}

function CopyableCode({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard API が使えない環境は諦める
    }
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
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
  );
}
