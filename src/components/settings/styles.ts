import type { CSSProperties } from "react";

export const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.4em",
  color: "#8a93b8",
  marginBottom: 8,
};

export const cardStyle: CSSProperties = {
  width: "min(640px, 100%)",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: "28px",
};

export const sectionStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.3em",
  color: "#8a93b8",
  marginBottom: 18,
  textTransform: "uppercase",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e6e9f5",
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
  color: "#8a93b8",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 8,
};

export function btnStyle(): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e6e9f5",
    fontSize: 13,
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
}
