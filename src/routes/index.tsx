import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import {
  dismissProgramFn,
  generateProgramFn,
  listProgramsFn,
} from "@/server/programs";
import {
  createProfileFn,
  deleteProfileFn,
  listProfilesFn,
  setActiveProfileFn,
  type ProfilesState,
} from "@/server/settings";
import {
  historyAtom,
  isPlayingAtom,
  playingProgramIdAtom,
  segmentIndexAtom,
} from "@/lib/atoms";
import { SettingsPanel } from "@/components/SettingsPanel";
import type { Program } from "@/lib/queue.types";

export const Route = createFileRoute("/")({
  component: Home,
  loader: () => listProgramsFn(),
});

const MIN_QUEUE = 2;

function Home() {
  const initial = Route.useLoaderData();
  const [programs, setPrograms] = useState<Program[]>(initial.programs);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [playing, setPlaying] = useAtom(isPlayingAtom);
  const [showSettings, setShowSettings] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [history, setHistory] = useAtom(historyAtom);
  const [playingId, setPlayingId] = useAtom(playingProgramIdAtom);
  const [segIndex, setSegIndex] = useAtom(segmentIndexAtom);
  const [profiles, setProfiles] = useState<ProfilesState | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProfilesFn().then((s) => {
      if (!cancelled) setProfiles(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (showSettings && !dlg.open) dlg.showModal();
    if (!showSettings && dlg.open) dlg.close();
  }, [showSettings]);

  const switchProfile = useCallback(
    async (id: string) => {
      if (!profiles || id === profiles.activeProfileId) return;
      setProfileError(null);
      const res = await setActiveProfileFn({ data: { id } });
      if (res.status !== "ok") {
        setProfileError(res.message);
        return;
      }
      setProfiles(res.state);
    },
    [profiles],
  );

  const createNewProfile = useCallback(
    async (fromActive: boolean) => {
      if (!profiles) return;
      const name = window.prompt(
        fromActive ? "複製したプロファイルの名前" : "新しいプロファイルの名前",
        "",
      );
      if (!name || !name.trim()) return;
      setProfileError(null);
      const res = await createProfileFn({
        data: {
          name: name.trim(),
          fromId: fromActive ? profiles.activeProfileId : undefined,
        },
      });
      if (res.status !== "ok") {
        setProfileError(res.message);
        return;
      }
      // 追加直後はそのまま active のまま据え置く（一覧だけ更新）。
      // 必要なら作成したプロファイルへ切替する。
      const created = res.state.profiles.find(
        (p) =>
          p.name === name.trim() &&
          !profiles.profiles.some((existing) => existing.id === p.id),
      );
      if (created) {
        const sw = await setActiveProfileFn({ data: { id: created.id } });
        if (sw.status === "ok") {
          setProfiles(sw.state);
          return;
        }
        setProfileError(sw.message);
      }
      setProfiles(res.state);
    },
    [profiles],
  );

  const deleteActiveProfile = useCallback(async () => {
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
    setProfileError(null);
    const res = await deleteProfileFn({
      data: { id: profiles.activeProfileId },
    });
    if (res.status !== "ok") {
      setProfileError(res.message);
      return;
    }
    setProfiles(res.state);
  }, [profiles]);

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
        setError(
          result.reason === "no-fresh"
            ? "新規ニュースがありません。しばらく経ってからお試しください。（過去14日に番組化済みの記事は除外しています）"
            : "ニュースソースが選択されていません。設定から選んでください。",
        );
        return;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [generating, refresh]);

  // どこかの番組が合成中（audioSegments < expectedSegmentCount）なら速めにポーリング
  const anyStreaming = programs.some(
    (p) => p.audioSegments.length < p.expectedSegmentCount,
  );
  useEffect(() => {
    const interval = anyStreaming ? 1500 : 5000;
    const t = setInterval(refresh, interval);
    return () => clearInterval(t);
  }, [refresh, anyStreaming]);

  useEffect(() => {
    if (programs.length < MIN_QUEUE && !generating && !error) {
      generate();
    }
  }, [programs.length, generating, generate, error]);

  const current = programs[0];
  const upcoming = programs.slice(1);

  // 番組が切り替わったらセグメント位置を 0 に戻す
  useEffect(() => {
    const nextId = current?.id ?? null;
    if (nextId !== playingId) {
      setPlayingId(nextId);
      setSegIndex(0);
    }
  }, [current?.id, playingId, setPlayingId, setSegIndex]);

  const archive = useCallback(
    (program: Program) => {
      if (program.sources.length === 0) return;
      const playedAt = new Date().toISOString();
      const entries = program.sources.map((s) => ({ ...s, playedAt }));
      setHistory((prev) => [...entries, ...prev]);
    },
    [setHistory],
  );

  const finishCurrent = useCallback(async () => {
    if (!current) return;
    archive(current);
    setSegIndex(0);
    await dismissProgramFn({ data: { id: current.id } });
    await refresh();
  }, [current, refresh, archive, setSegIndex]);

  const handleEnded = useCallback(async () => {
    if (!current) return;
    const next = segIndex + 1;
    if (next < current.expectedSegmentCount) {
      // まだ番組は続く。次の URL が来てない可能性があるので即 refresh も投げる。
      setSegIndex(next);
      if (next >= current.audioSegments.length) {
        refresh().catch(() => {});
      }
      return;
    }
    await finishCurrent();
  }, [current, segIndex, setSegIndex, finishCurrent, refresh]);

  const skip = useCallback(async () => {
    await finishCurrent();
  }, [finishCurrent]);

  const currentSegmentUrl = current?.audioSegments[segIndex]?.url;

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
      <header style={{ textAlign: "center", width: "min(640px, 100%)" }}>
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
      </header>

      {profiles && (
        <section
          style={{
            width: "min(640px, 100%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              color: "#8a93b8",
            }}
          >
            PROFILE
          </span>
          <select
            value={profiles.activeProfileId}
            onChange={(e) => {
              void switchProfile(e.target.value);
            }}
            style={{
              flex: "1 1 200px",
              padding: "8px 12px",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#e6e9f5",
              fontSize: 14,
              fontFamily: "inherit",
            }}
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
            style={profileBtnStyle()}
          >
            新規
          </button>
          <button
            type="button"
            onClick={() => void createNewProfile(true)}
            style={profileBtnStyle()}
          >
            複製
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            style={profileBtnStyle()}
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => void deleteActiveProfile()}
            disabled={profiles.profiles.length <= 1}
            style={{
              ...profileBtnStyle(),
              opacity: profiles.profiles.length <= 1 ? 0.4 : 1,
            }}
          >
            削除
          </button>
          {profileError && (
            <div
              style={{
                width: "100%",
                fontSize: 12,
                color: "#ffb8c0",
                marginTop: 4,
              }}
            >
              {profileError}
            </div>
          )}
        </section>
      )}

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
              {new Date(current.createdAt).toLocaleString("ja-JP")} · by{" "}
              {current.llm?.label ?? "不明な LLM"}
            </div>

            {currentSegmentUrl ? (
              <audio
                ref={audioRef}
                key={`${current.id}:${segIndex}:${currentSegmentUrl}`}
                src={currentSegmentUrl}
                autoPlay
                controls
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={handleEnded}
                style={{ width: "100%" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  padding: "16px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  fontSize: 12,
                  color: "#8a93b8",
                  textAlign: "center",
                }}
              >
                次の段落を準備しています...
              </div>
            )}
            <div style={{ fontSize: 11, color: "#5a6188", marginTop: 6 }}>
              段落 {Math.min(segIndex + 1, current.expectedSegmentCount)} /{" "}
              {current.expectedSegmentCount}
              {current.audioSegments.length < current.expectedSegmentCount && (
                <span style={{ marginLeft: 8, color: "#ff7a8a" }}>
                  · 合成中 ({current.audioSegments.length}/
                  {current.expectedSegmentCount})
                </span>
              )}
            </div>

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
                {generating ? "生成中..." : "+ 生成"}
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
                <span style={{ flex: 1, fontSize: 14 }}>
                  {p.title}
                  {p.llm?.label && (
                    <span style={{ fontSize: 11, color: "#5a6188", marginLeft: 8 }}>
                      {p.llm.label}
                    </span>
                  )}
                </span>
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

      <dialog
        ref={dialogRef}
        onClose={() => setShowSettings(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setShowSettings(false);
        }}
        style={{
          position: "fixed",
          inset: "auto",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          margin: 0,
          width: "min(720px, 100%)",
          maxHeight: "calc(100vh - 96px)",
          padding: 32,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          background: "#10142a",
          color: "#e6e9f5",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {showSettings && (
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onProfilesChange={setProfiles}
            />
          )}
        </div>
      </dialog>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
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

function profileBtnStyle(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e6e9f5",
    fontSize: 12,
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
}
