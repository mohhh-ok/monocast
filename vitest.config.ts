import { defineConfig } from "vitest/config";

// アプリ本体の vite.config.ts は TanStack Start プラグインを読み込むため、
// テストでは使わず最小構成の設定を別立てにする。
// ただしモジュール解決（@/ エイリアス）は本体と揃える。
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // spy/stub をテストごとに自動復元する（手動 mockRestore の書き忘れ防止）
    restoreMocks: true,
  },
});
