import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import {
  dismissProgramFn,
  generateProgramFn,
  listProgramsFn,
} from "@/server/programs";
import { historyAtom } from "@/lib/atoms";

export const Route = createFileRoute("/")({
  component: Home,
  loader: () => listProgramsFn(),
});

type Program = {
  id: string;
  title: string;
  body: string;
  audioUrl: string;
  durationSec: number;
  createdAt: string;
  sources: { title: string; link: string; source: string }[];
};

const MIN_QUEUE = 2;

function Home() {
  const initial = Route.useLoaderData();
  const [programs, setPrograms] = useState<Program[]>(initial.programs);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [history, setHistory] = useAtom(historyAtom);

  const refresh = useCallback(async () => {
    const data = await listProgramsFn();
    setPrograms(data.programs || []);
  }, []);

  const generate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateProgramFn();
      if (result.status === "error") throw new Error(result.message);
      if (result.status === "empty") {
        setError("ニュースソースが選択されていません。/settings で選んでください。");
        return;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [generating, refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (programs.length < MIN_QUEUE && !generating && !error) {
      generate();
    }
  }, [programs.length, generating, generate, error]);

  const current = programs[0];
  const upcoming = programs.slice(1);

  const archive = useCallback(
    (program: Program) => {
      if (program.sources.length === 0) return;
      const playedAt = new Date().toISOString();
      const entries = program.sources.map((s) => ({ ...s, playedAt }));
      setHistory((prev) => [...entries, ...prev]);
    },
    [setHistory],
  );

  const handleEnded = useCallback(async () => {
    if (!current) return;
    archive(current);
    await dismissProgramFn({ data: { id: current.id } });
    await refresh();
  }, [current, refresh, archive]);

  const skip = useCallback(async () => {
    if (!current) return;
    archive(current);
    await dismissProgramFn({ data: { id: current.id } });
    await refresh();
  }, [current, refresh, archive]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px 96px",
        gap: 32,
      }}
    >
      <header style={{ textAlign: "center", position: "relative", width: "min(640px, 100%)" }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.4em",
            color: "#8a93b8",
            marginBottom: 8,
          }}
        >
          ON AIR · MONOCAST
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "#cbd2ee" }}>
          ひとりのための、ききながし
        </h1>
        <Link
          to="/settings"
          aria-label="設定"
          style={{
            position: "absolute",
            top: -4,
            right: 0,
            fontSize: 32,
            lineHeight: 1,
            color: "#8a93b8",
            textDecoration: "none",
            padding: 4,
          }}
        >
          ⚙
        </Link>
      </header>

      <section
        style={{
          width: "min(640px, 100%)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "32px 28px",
          boxShadow: "0 30px 80px -40px rgba(0,0,0,0.7)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#ff7a8a",
            fontSize: 11,
            letterSpacing: "0.3em",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#ff5a6e",
              boxShadow: playing ? "0 0 16px #ff5a6e" : "none",
              animation: playing ? "pulse 1.4s ease-in-out infinite" : "none",
            }}
          />
          {playing ? "PLAYING" : "STANDBY"}
        </div>

        {current ? (
          <>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.3,
                marginBottom: 6,
              }}
            >
              {current.title}
            </div>
            <div style={{ fontSize: 12, color: "#8a93b8", marginBottom: 24 }}>
              約 {current.durationSec} 秒 ·{" "}
              {new Date(current.createdAt).toLocaleString("ja-JP")}
            </div>

            <audio
              ref={audioRef}
              src={current.audioUrl}
              autoPlay
              controls
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={handleEnded}
              style={{ width: "100%" }}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <button onClick={skip} style={btnStyle()} aria-label="次の番組へ">
                ⏭ スキップ
              </button>
              <button
                onClick={() => setShowScript((v) => !v)}
                style={btnStyle()}
              >
                {showScript ? "原稿を隠す" : "原稿を見る"}
              </button>
              <button
                onClick={generate}
                disabled={generating}
                style={btnStyle(generating)}
              >
                {generating ? "生成中..." : "+ 1本生成"}
              </button>
            </div>

            {showScript && (
              <pre
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  color: "#cbd2ee",
                  fontFamily: "inherit",
                }}
              >
                {current.body}
              </pre>
            )}

            {current.sources.length > 0 && (
              <details style={{ marginTop: 16, fontSize: 12, color: "#8a93b8" }}>
                <summary style={{ cursor: "pointer" }}>
                  この番組の元ニュース ({current.sources.length})
                </summary>
                <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
                  {current.sources.map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        [{s.source}] {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {history.length > 0 && (
              <details style={{ marginTop: 8, fontSize: 12, color: "#8a93b8" }}>
                <summary style={{ cursor: "pointer" }}>
                  これまでのソース ({history.length})
                </summary>
                <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
                  {history.map((s, i) => (
                    <li key={`${s.playedAt}-${i}`}>
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        [{s.source}] {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "#8a93b8",
            }}
          >
            {generating
              ? "最初の番組を準備しています..."
              : "番組がありません"}
          </div>
        )}
      </section>

      <section style={{ width: "min(640px, 100%)" }}>
        <h2
          style={{
            fontSize: 11,
            letterSpacing: "0.3em",
            color: "#8a93b8",
            marginBottom: 12,
          }}
        >
          UP NEXT
        </h2>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5a6188" }}>
            {generating ? "次の番組を生成中..." : "まだありません"}
          </div>
        ) : (
          <ol style={{ listStyle: "none", display: "grid", gap: 8 }}>
            {upcoming.map((p, i) => (
              <li
                key={p.id}
                style={{
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#5a6188", fontSize: 12, width: 24 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ flex: 1, fontSize: 14 }}>{p.title}</span>
                <span style={{ fontSize: 11, color: "#5a6188" }}>
                  {p.durationSec}s
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            background: "#3a1620",
            border: "1px solid #ff5a6e",
            borderRadius: 8,
            color: "#ffb8c0",
            fontSize: 13,
            maxWidth: "min(600px, 90vw)",
          }}
        >
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </main>
  );
}

function btnStyle(disabled = false): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e6e9f5",
    fontSize: 13,
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.15s",
  };
}
