import type { ReactNode } from "react";

type Props = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, hint, children }: Props) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: "#8a93b8", marginBottom: 6 }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "#5a6188", marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
