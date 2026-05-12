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
import { ErrorToast } from "@/components/ErrorToast";
import { NowPlayingCard } from "@/components/NowPlayingCard";
import { ProfileBar } from "@/components/ProfileBar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { UpNextList } from "@/components/UpNextList";
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
      // 作成したプロファイルを active に切り替える（一覧から新規 id を逆引き）
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
        <ProfileBar
          profiles={profiles}
          errorMessage={profileError}
          onSwitch={(id) => void switchProfile(id)}
          onCreate={(fromActive) => void createNewProfile(fromActive)}
          onEdit={() => setShowSettings(true)}
          onDelete={() => void deleteActiveProfile()}
        />
      )}

      <NowPlayingCard
        current={current}
        generating={generating}
        playing={playing}
        segIndex={segIndex}
        audioRef={audioRef}
        showScript={showScript}
        setShowScript={setShowScript}
        history={history}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => void handleEnded()}
        onSkip={() => void finishCurrent()}
        onGenerate={() => void generate()}
      />

      <UpNextList upcoming={upcoming} generating={generating} />

      {error && <ErrorToast message={error} />}

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onProfilesChange={setProfiles}
      />

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
