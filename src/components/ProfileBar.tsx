import { useEffect, useRef, useState, type CSSProperties } from "react";
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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!menuRootRef.current) return;
      if (!menuRootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const duplicateDisabled = isRandom;
  const deleteDisabled = isRandom || profiles.profiles.length <= 1;

  const runMenu = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

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
        style={{
          fontSize: 11,
          letterSpacing: "0.3em",
          color: "var(--amber-dim)",
        }}
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

      <button
        type="button"
        onClick={onEdit}
        disabled={isRandom}
        style={dimStyle(isRandom)}
      >
        編集
      </button>

      <div ref={menuRootRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={btnStyle}
          title="その他の操作"
        >
          その他 ▾
        </button>
        {menuOpen && (
          <div role="menu" style={menuStyle}>
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenu(() => onCreate(false))}
              style={menuItemStyle(false)}
            >
              新規
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenu(() => onCreate(true))}
              disabled={duplicateDisabled}
              style={menuItemStyle(duplicateDisabled)}
            >
              複製
            </button>
            <div style={menuSeparatorStyle} />
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenu(onDelete)}
              disabled={deleteDisabled}
              style={{
                ...menuItemStyle(deleteDisabled),
                color: deleteDisabled ? "var(--cream)" : "#ff8a7a",
              }}
            >
              削除
            </button>
          </div>
        )}
      </div>

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
  borderRadius: 6,
  background: "rgba(255, 182, 72, 0.06)",
  border: "1px solid var(--radio-line)",
  color: "var(--cream)",
  fontSize: 12,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  right: 0,
  minWidth: 140,
  padding: 4,
  background: "var(--radio-panel)",
  border: "1px solid var(--radio-line)",
  borderRadius: 6,
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
};

const menuSeparatorStyle: CSSProperties = {
  height: 1,
  margin: "4px 2px",
  background: "var(--radio-line-faint)",
};

const menuItemStyle = (disabled: boolean): CSSProperties => ({
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 4,
  background: "transparent",
  border: "none",
  color: "var(--cream)",
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.4 : 1,
  fontFamily: "inherit",
});
