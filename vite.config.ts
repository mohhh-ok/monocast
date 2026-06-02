import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    resolve: { tsconfigPaths: true },
    server: { port: Number(env.PORT || 3000) },
    plugins: [tanstackStart(), viteReact()],
  };
});
