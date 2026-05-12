import type { CSSProperties } from "react";
import type { ProfilesState } from "@/server/settings";

type Props = {
  profiles: ProfilesState;
  errorMessage: string | null;
  onSwitch: (id: string) => void;
  onCreate: (fromActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function ProfileBar({
  profiles,
  errorMessage,
  onSwitch,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  return (
    <section
      style={{
        width: "min(640px, 100%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{ fontSize: 11, letterSpacing: "0.3em", color: "#8a93b8" }}
      >
        PROFILE
      </span>
      <select
        value={profiles.activeProfileId}
        onChange={(e) => onSwitch(e.target.value)}
        style={{
          flex: "1 1 200px",
          padding: "8px 12px",
          background: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          color: "#e6e9f5",
          fontSize: 14,
          fontFamily: "inherit",
        }}
      >
        {profiles.profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onCreate(false)} style={btnStyle}>
        新規
      </button>
      <button type="button" onClick={() => onCreate(true)} style={btnStyle}>
        複製
      </button>
      <button type="button" onClick={onEdit} style={btnStyle}>
        編集
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={profiles.profiles.length <= 1}
        style={{
          ...btnStyle,
          opacity: profiles.profiles.length <= 1 ? 0.4 : 1,
        }}
      >
        削除
      </button>
      {errorMessage && (
        <div
          style={{
            width: "100%",
            fontSize: 12,
            color: "#ffb8c0",
            marginTop: 4,
          }}
        >
          {errorMessage}
        </div>
      )}
    </section>
  );
}

const btnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#e6e9f5",
  fontSize: 12,
  whiteSpace: "nowrap",
  cursor: "pointer",
};
