import type { Program } from "@/lib/queue.types";

type Props = {
  upcoming: Program[];
  generating: boolean;
};

export function UpNextList({ upcoming, generating }: Props) {
  return (
    <section style={{ width: "min(640px, 100%)" }}>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.3em",
          color: "var(--amber-dim)",
          marginBottom: 12,
        }}
      >
        PRESET — UP NEXT
        <span
          aria-hidden="true"
          style={{
            flex: 1,
            height: 1,
            background: "var(--radio-line-faint)",
          }}
        />
      </h2>
      {upcoming.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--cream-faint)" }}>
          {generating ? "次の番組を生成中..." : "まだありません"}
        </div>
      ) : (
        <ol style={{ listStyle: "none", display: "grid", gap: 8 }}>
          {upcoming.map((p, i) => (
            <li
              key={p.id}
              style={{
                padding: "12px 16px",
                background:
                  "linear-gradient(180deg, rgba(255, 182, 72, 0.03), transparent), var(--radio-panel-deep)",
                border: "1px solid var(--radio-line-faint)",
                borderRadius: 8,
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              {/* プリセット局ボタン風の番号 */}
              <span
                style={{
                  width: 26,
                  height: 26,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  border: "1px solid var(--radio-line)",
                  color: "var(--amber)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: "var(--cream)" }}>
                {p.title}
                {p.llm?.label && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--cream-faint)",
                      marginLeft: 8,
                    }}
                  >
                    {p.llm.label}
                  </span>
                )}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--cream-faint)",
                }}
              >
                {p.durationSec}s
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
