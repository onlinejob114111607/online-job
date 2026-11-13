// بناء واجهة المتجر لحالها (موقع منفصل): npx vite build --config vite.store.config.js ← dist-store
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./store", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist-store", import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
