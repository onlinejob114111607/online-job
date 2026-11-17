import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { SUPABASE } from "./src/config.js";

// لما يكون SUPABASE.active = true بـ src/config.js: كل استيراد لـ firebase بيروح للبديل
const supa = (f) => fileURLToPath(new URL(`./src/supa/${f}`, import.meta.url));
export const dbAlias = SUPABASE.active && SUPABASE.url
  ? [
      { find: /^firebase\/firestore(\/lite)?$/, replacement: supa("firestore.js") },
      { find: /^firebase\/auth$/, replacement: supa("auth.js") },
      { find: /^firebase\/app$/, replacement: supa("app.js") },
    ]
  : [];

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: dbAlias },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
