import { defineConfig } from "vite";

// base نسبي: الموقع بيشتغل من أي مسار (مثلاً /online-job/osama/)
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]three[\\/]/.test(id)) return "three";
        },
      },
    },
  },
});
