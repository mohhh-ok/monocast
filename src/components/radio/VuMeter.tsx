type Props = {
  /** 再生中だけバーを揺らす */
  active: boolean;
};

const BAR_COUNT = 7;

/**
 * VU メーター風の装飾。
 * CSS アニメーションで揺らしているだけで、実際の音声レベルは解析していない。
 */
export function VuMeter({ active }: Props) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: 26,
        padding: "4px 8px",
        borderRadius: 6,
        background: "var(--radio-panel-deep)",
        border: "1px solid var(--radio-line-faint)",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          className={active ? "vu-bar on" : "vu-bar"}
          style={{
            width: 4,
            height: "100%",
            borderRadius: 1,
            background:
              i >= BAR_COUNT - 2
                ? "var(--needle-red)"
                : "linear-gradient(180deg, var(--amber-bright), var(--amber-dim))",
            opacity: active ? 0.95 : 0.4,
            // 各バーの揺れをずらす（パターンは styles.css の nth-child で分岐）
            animationDelay: `${(i * 0.13).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}
