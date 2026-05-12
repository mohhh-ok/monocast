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
                  <span
                    style={{ fontSize: 11, color: "#5a6188", marginLeft: 8 }}
                  >
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
  );
}
