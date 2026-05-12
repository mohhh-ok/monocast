import type { CSSProperties, RefObject } from "react";
import type { HistorySource } from "@/lib/atoms";
import type { Program } from "@/lib/queue.types";

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

  return (
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
              onPlay={onPlay}
              onPause={onPause}
              onEnded={onEnded}
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
            <button onClick={onSkip} style={btnStyle()} aria-label="次の番組へ">
              ⏭ スキップ
            </button>
            <button
              onClick={() => setShowScript((v) => !v)}
              style={btnStyle()}
            >
              {showScript ? "原稿を隠す" : "原稿を見る"}
            </button>
            <button
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
                    <a href={s.link} target="_blank" rel="noopener noreferrer">
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
            color: "#8a93b8",
          }}
        >
          {generating ? "最初の番組を準備しています..." : "番組がありません"}
        </div>
      )}
    </section>
  );
}

function btnStyle(disabled = false): CSSProperties {
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
