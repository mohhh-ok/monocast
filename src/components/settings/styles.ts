import type { CSSProperties } from "react";

export const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.4em",
  color: "var(--amber-dim)",
  marginBottom: 8,
};

export const cardStyle: CSSProperties = {
  width: "min(640px, 100%)",
  background:
    "linear-gradient(180deg, var(--radio-panel) 0%, var(--radio-panel-deep) 100%)",
  border: "1px solid var(--radio-line)",
  borderRadius: 14,
  padding: "28px",
};

export const sectionStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.3em",
  color: "var(--amber-dim)",
  marginBottom: 18,
  textTransform: "uppercase",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--radio-line-faint)",
  borderRadius: 6,
  color: "var(--cream)",
  fontSize: 14,
  fontFamily: "inherit",
};

export const sourceItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  padding: "4px 0",
};

export const closeBtnStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  fontSize: 24,
  lineHeight: 1,
  color: "var(--cream-dim)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 8,
};

export function btnStyle(): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 6,
    background: "rgba(255, 182, 72, 0.06)",
    border: "1px solid var(--radio-line)",
    color: "var(--cream)",
    fontSize: 13,
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
}
