import { createFileRoute } from "@tanstack/react-router";
import { SettingsPanel } from "@/components/SettingsPanel";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px 96px",
        gap: 24,
      }}
    >
      <SettingsPanel />
    </main>
  );
}
