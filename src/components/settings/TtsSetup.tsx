import { useState, type ReactNode } from "react";
import type { TtsId } from "@/config.shared";
import { btnStyle } from "./styles";

type Step = {
  label: string;
  command?: string;
  link?: { href: string; text: string };
  note?: string;
};

const STEPS: Record<TtsId, Step[]> = {
  voicevox: [
    {
      label: "VOICEVOX を入手",
      link: {
        href: "https://voicevox.hiroshiba.jp/",
        text: "voicevox.hiroshiba.jp",
      },
      note: "公式アプリ版を使うか、下のコマンドで Docker で起動",
    },
    {
      label: "サーバを起動",
      command: "docker compose --profile voicevox up -d",
      note: "既定で http://localhost:50021 を listen",
    },
  ],
  aivisspeech: [
    {
      label: "AivisSpeech を入手",
      link: {
        href: "https://aivis-project.com/",
        text: "aivis-project.com",
      },
      note: "公式アプリ版を使うか、下のコマンドで Docker で起動",
    },
    {
      label: "サーバを起動",
      command: "docker compose --profile aivisspeech up -d",
      note: "既定で http://localhost:10101 を listen",
    },
  ],
  say: [
    {
      label: "macOS のみ対応",
      note: "say コマンドが組み込まれているため追加インストール不要",
    },
    {
      label: "利用可能な voice を確認",
      command: 'say -v "?"',
      note: "Kyoko / Otoya など ja_JP の voice を選ぶと日本語が自然",
    },
    {
      label: "日本語 voice を追加 (必要なら)",
      note: "システム設定 → アクセシビリティ → 読み上げコンテンツ → システムの声 → 声を管理",
    },
  ],
  sapi: [
    {
      label: "Windows のみ対応",
      note: "SAPI が組み込まれているため追加インストール不要 (PowerShell 経由で呼び出す)",
    },
    {
      label: "利用可能な voice を確認",
      command:
        'powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | %{ $_.VoiceInfo }"',
      note: "Haruka / Ayumi / Ichiro など ja-JP の voice があれば日本語が自然",
    },
    {
      label: "日本語 voice を追加 (必要なら)",
      note: "設定 → 時刻と言語 → 音声認識 → 音声の管理から日本語パックを追加",
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
  elevenlabs: [
    {
      label: "API キーを発行",
      link: {
        href: "https://elevenlabs.io/app/settings/api-keys",
        text: "elevenlabs.io",
      },
    },
    {
      label: "環境変数として設定",
      command: "export ELEVENLABS_API_KEY=...",
      note: ".env もしくはシェルに設定して再起動",
    },
    {
      label: "Voice ID を確認",
      link: {
        href: "https://elevenlabs.io/app/voice-library",
        text: "Voice Library",
      },
      note: "使いたい voice の ID をコピーして上の入力欄に貼り付け",
    },
  ],
  kokoro: [
    {
      label: "Kokoro-FastAPI を起動",
      command: "docker compose --profile kokoro up -d",
      link: {
        href: "https://github.com/remsky/Kokoro-FastAPI",
        text: "remsky/Kokoro-FastAPI",
      },
      note: "既定で http://localhost:8880 を listen",
    },
    {
      label: "voice を選択",
      note: "jf_/jm_=日本語, af_/am_=英語(米), bf_/bm_=英語(英), zf_/zm_=中国語",
    },
  ],
};

export function TtsSetup({ id }: { id: TtsId }) {
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
