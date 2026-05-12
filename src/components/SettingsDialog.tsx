import { useEffect, useRef } from "react";
import { SettingsPanel } from "./SettingsPanel";
import type { ProfilesState } from "@/server/settings";

type Props = {
  open: boolean;
  onClose: () => void;
  onProfilesChange: (state: ProfilesState) => void;
};

export function SettingsDialog({ open, onClose, onProfilesChange }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: "auto",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        margin: 0,
        width: "min(720px, 100%)",
        maxHeight: "calc(100vh - 96px)",
        padding: 32,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        background: "#10142a",
        color: "#e6e9f5",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {open && (
          <SettingsPanel onClose={onClose} onProfilesChange={onProfilesChange} />
        )}
      </div>
    </dialog>
  );
}
