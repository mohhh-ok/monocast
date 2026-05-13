import type { CSSProperties } from "react";
import { RANDOM_PROFILE_ID, RANDOM_PROFILE_NAME } from "@/config.shared";
import type { ProfilesState } from "@/server/settings";
import { SearchableSelect } from "./SearchableSelect";

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
  const isRandom = profiles.activeProfileId === RANDOM_PROFILE_ID;
  // 実プロファイルが 1 つ以下ならランダムは無意味なので隠す。
  const showRandom = profiles.profiles.length >= 2 || isRandom;
  const options = [
    ...profiles.profiles.map((p) => ({ value: p.id, label: p.name })),
    ...(showRandom
      ? [{ value: RANDOM_PROFILE_ID, label: RANDOM_PROFILE_NAME }]
      : []),
  ];
  const dimStyle = (disabled: boolean): CSSProperties => ({
    ...btnStyle,
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  });

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
      <SearchableSelect
        value={profiles.activeProfileId}
        options={options}
        onChange={onSwitch}
        style={{ flex: "1 1 200px" }}
        inputStyle={{ padding: "8px 12px" }}
      />

      <button type="button" onClick={() => onCreate(false)} style={btnStyle}>
        新規
      </button>
      <button
        type="button"
        onClick={() => onCreate(true)}
        disabled={isRandom}
        style={dimStyle(isRandom)}
      >
        複製
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={isRandom}
        style={dimStyle(isRandom)}
      >
        編集
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isRandom || profiles.profiles.length <= 1}
        style={dimStyle(isRandom || profiles.profiles.length <= 1)}
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
