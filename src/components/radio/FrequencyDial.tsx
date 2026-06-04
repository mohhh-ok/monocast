import type { CSSProperties } from "react";
import { FM_MAX, FM_MIN, progressToFrequency } from "@/lib/dial";

type Props = {
  /** 番組全体の再生進捗 0..1。針の位置になる。 */
  progress: number;
  /** 再生中はバックライトを強める */
  lit: boolean;
};

const LABEL_FREQS = [76, 80, 84, 88, 92, 95];
const MINOR_STEP = 1;

function freqToPercent(freq: number): number {
  return ((freq - FM_MIN) / (FM_MAX - FM_MIN)) * 100;
}

/**
 * ヴィンテージチューナー風の周波数スケール。
 * 針は再生進捗の表示専用で、シーク操作は持たない。
 */
export function FrequencyDial({ progress, lit }: Props) {
  const percent = Math.min(Math.max(progress, 0), 1) * 100;
  const freq = progressToFrequency(progress);

  const minors: number[] = [];
  for (let f = FM_MIN; f <= FM_MAX; f += MINOR_STEP) {
    minors.push(f);
  }

  return (
    <div style={windowStyle(lit)} aria-hidden="true">
      <div style={bandLabelStyle}>
        <span>FM</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>
          {freq.toFixed(1)} MHz
        </span>
      </div>

      <div style={{ position: "relative", height: 34 }}>
        {minors.map((f) => (
          <span
            key={f}
            style={{
              position: "absolute",
              left: `${freqToPercent(f)}%`,
              bottom: 0,
              width: 1,
              height: LABEL_FREQS.includes(f) ? 12 : 7,
              background: LABEL_FREQS.includes(f)
                ? "var(--amber-dim)"
                : "var(--radio-line)",
            }}
          />
        ))}
        {LABEL_FREQS.map((f) => (
          <span
            key={`label-${f}`}
            style={{
              position: "absolute",
              left: `${freqToPercent(f)}%`,
              top: 0,
              transform: "translateX(-50%)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--amber-dim)",
              letterSpacing: "0.05em",
            }}
          >
            {f}
          </span>
        ))}
        <span
          className="dial-needle"
          style={{
            position: "absolute",
            left: `${percent}%`,
            top: -2,
            bottom: -6,
            width: 2,
            marginLeft: -1,
            background: "var(--needle-red)",
            boxShadow: lit ? "0 0 8px rgba(255, 74, 60, 0.8)" : "none",
          }}
        />
      </div>
    </div>
  );
}

function windowStyle(lit: boolean): CSSProperties {
  return {
    padding: "10px 14px 14px",
    borderRadius: 8,
    background:
      "linear-gradient(180deg, rgba(255, 182, 72, 0.08) 0%, rgba(255, 182, 72, 0.02) 100%), var(--radio-panel-deep)",
    border: "1px solid var(--radio-line)",
    boxShadow: lit
      ? "inset 0 0 24px rgba(255, 182, 72, 0.12), inset 0 2px 6px rgba(0,0,0,0.6)"
      : "inset 0 2px 6px rgba(0,0,0,0.6)",
    animation: lit ? "dial-glow 3s ease-in-out infinite" : "none",
  };
}

const bandLabelStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 10,
  letterSpacing: "0.2em",
  color: "var(--amber)",
  marginBottom: 8,
};
