import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { HistorySource } from "@/lib/atoms";
import { playbackProgress } from "@/lib/dial";
import type { Program } from "@/lib/queue.types";
import { FrequencyDial } from "./radio/FrequencyDial";
import { VuMeter } from "./radio/VuMeter";

type Props = {
  current: Program | undefined;
  generating: boolean;
  playing: boolean;
  segIndex: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  showScript: boolean;
  setShowScript: (v: boolean | ((prev: boolean) => boolean)) => void;
  history: HistorySource[];
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onSkip: () => void;
  onGenerate: () => void;
};

export function NowPlayingCard({
  current,
  generating,
  playing,
  segIndex,
  audioRef,
  showScript,
  setShowScript,
  history,
  onPlay,
  onPause,
  onEnded,
  onSkip,
  onGenerate,
}: Props) {
  const currentSegmentUrl = current?.audioSegments[segIndex]?.url;

  // セグメント内の再生位置 0..1（周波数ダイヤルの針に使う）
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const volumeRef = useRef(1);

  // 番組・セグメントが切り替わったら針の位置をセグメント先頭へ戻す
  useEffect(() => {
    setSegmentProgress(0);
  }, [current?.id, segIndex]);

  // <audio> は key で再マウントされ autoPlay が即座に鳴り出すため、
  // effect（paint 後）ではなく ref callback でマウント直後に音量を適用する
  const attachAudio = useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      if (el) el.volume = volumeRef.current;
    },
    [audioRef],
  );

  const changeVolume = useCallback(
    (v: number) => {
      setVolume(v);
      volumeRef.current = v;
      if (audioRef.current) audioRef.current.volume = v;
    },
    [audioRef],
  );

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, [audioRef]);

  const progress = current
    ? playbackProgress(segIndex, segmentProgress, current.expectedSegmentCount)
    : 0;

  return (
    <section
      style={{
        width: "min(640px, 100%)",
        background:
          "linear-gradient(180deg, rgba(255, 182, 72, 0.05) 0%, transparent 30%), linear-gradient(180deg, var(--radio-panel) 0%, var(--radio-panel-deep) 100%)",
        border: "1px solid var(--radio-line)",
        borderRadius: 14,
        padding: "24px 28px 28px",
        boxShadow:
          "0 30px 80px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255, 210, 138, 0.12)",
      }}
    >
      {/* 銘板 + ON AIR ランプ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          paddingBottom: 14,
          borderBottom: "1px solid var(--radio-line-faint)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: playing ? "var(--needle-red)" : "var(--cream-faint)",
            fontSize: 11,
            letterSpacing: "0.3em",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: playing ? "var(--needle-red)" : "#4a3526",
              boxShadow: playing ? "0 0 16px var(--needle-red)" : "none",
              animation: playing ? "pulse 1.4s ease-in-out infinite" : "none",
            }}
          />
          {playing ? "ON AIR" : "STANDBY"}
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.25em",
            color: "var(--amber-dim)",
            border: "1px solid var(--radio-line)",
            borderRadius: 3,
            padding: "3px 8px",
          }}
        >
          MONOCAST · SOLID STATE TUNER
        </div>
      </div>

      {current ? (
        <>
          <FrequencyDial progress={progress} lit={playing} />

          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 27,
              fontWeight: 600,
              lineHeight: 1.35,
              margin: "20px 0 6px",
              color: "var(--cream)",
            }}
          >
            {current.title}
          </div>
          <div
            style={{ fontSize: 12, color: "var(--cream-dim)", marginBottom: 20 }}
          >
            約 {current.durationSec} 秒 ·{" "}
            {new Date(current.createdAt).toLocaleString("ja-JP")} · by{" "}
            {current.llm?.label ?? "不明な LLM"}
          </div>

          {/* 再生コントロール。<audio> 本体は下で非表示マウントしている */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={togglePlay}
              disabled={!currentSegmentUrl}
              aria-label={playing ? "一時停止" : "再生"}
              style={playButtonStyle(playing, !currentSegmentUrl)}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              onClick={onSkip}
              style={btnStyle()}
              aria-label="次の番組へ"
            >
              ⏭ TUNE
            </button>
            <VuMeter active={playing} />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "var(--cream-faint)",
                marginLeft: "auto",
              }}
            >
              VOL
              <input
                type="range"
                className="radio-volume"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </label>
          </div>

          {currentSegmentUrl ? (
            <audio
              ref={attachAudio}
              key={`${current.id}:${segIndex}:${currentSegmentUrl}`}
              src={currentSegmentUrl}
              autoPlay
              preload="auto"
              onPlay={onPlay}
              onPause={onPause}
              onEnded={onEnded}
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                if (el.duration > 0) {
                  setSegmentProgress(el.currentTime / el.duration);
                }
              }}
              onError={(e) => {
                const el = e.currentTarget;
                const err = el.error;
                console.error("[audio] error", {
                  programId: current.id,
                  segIndex,
                  src: el.currentSrc || el.src,
                  networkState: el.networkState,
                  readyState: el.readyState,
                  code: err?.code,
                  message: err?.message,
                });
              }}
              style={{ display: "none" }}
            />
          ) : (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 6,
                background: "var(--radio-panel-deep)",
                border: "1px solid var(--radio-line-faint)",
                fontSize: 12,
                color: "var(--cream-dim)",
                textAlign: "center",
              }}
            >
              次の段落を準備しています...
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--cream-faint)",
              marginTop: 14,
              letterSpacing: "0.1em",
            }}
          >
            TRACK {Math.min(segIndex + 1, current.expectedSegmentCount)} /{" "}
            {current.expectedSegmentCount}
            {current.audioSegments.length < current.expectedSegmentCount && (
              <span style={{ marginLeft: 8, color: "var(--amber)" }}>
                · REC ({current.audioSegments.length}/
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
            <button
              type="button"
              onClick={() => setShowScript((v) => !v)}
              style={btnStyle()}
            >
              {showScript ? "原稿を隠す" : "原稿を見る"}
            </button>
            <button
              type="button"
              onClick={onGenerate}
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
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--radio-line-faint)",
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                color: "var(--cream)",
                fontFamily: "inherit",
              }}
            >
              {current.body}
            </pre>
          )}

          {current.sources.length > 0 && (
            <details
              style={{ marginTop: 16, fontSize: 12, color: "var(--cream-dim)" }}
            >
              <summary style={{ cursor: "pointer" }}>
                この番組の元ニュース ({current.sources.length})
              </summary>
              <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
                {current.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.link} target="_blank" rel="noopener noreferrer">
                      [{s.source}] {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {history.length > 0 && (
            <details
              style={{ marginTop: 8, fontSize: 12, color: "var(--cream-dim)" }}
            >
              <summary style={{ cursor: "pointer" }}>
                これまでのソース ({history.length})
              </summary>
              <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
                {history.map((s, i) => (
                  <li key={`${s.playedAt}-${i}`}>
                    <a href={s.link} target="_blank" rel="noopener noreferrer">
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
            color: "var(--cream-dim)",
          }}
        >
          {generating ? "最初の番組を準備しています..." : "番組がありません"}
        </div>
      )}
    </section>
  );
}

function playButtonStyle(playing: boolean, disabled: boolean): CSSProperties {
  return {
    width: 56,
    height: 56,
    borderRadius: "50%",
    fontSize: 18,
    color: playing ? "var(--radio-panel-deep)" : "var(--amber)",
    background: playing
      ? "linear-gradient(180deg, var(--amber-bright), var(--amber))"
      : "linear-gradient(180deg, rgba(255, 182, 72, 0.14), rgba(255, 182, 72, 0.04))",
    border: "1px solid var(--amber-dim)",
    boxShadow: playing
      ? "0 0 24px var(--amber-glow), inset 0 1px 0 rgba(255,255,255,0.4)"
      : "inset 0 1px 0 rgba(255, 210, 138, 0.15)",
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.2s, box-shadow 0.2s",
  };
}

function btnStyle(disabled = false): CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 6,
    background: "rgba(255, 182, 72, 0.06)",
    border: "1px solid var(--radio-line)",
    color: "var(--cream)",
    fontSize: 13,
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.15s",
  };
}
