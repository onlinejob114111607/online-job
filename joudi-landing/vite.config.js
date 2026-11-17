import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base نسبي: الصفحة بتشتغل من أي مسار (مثلاً /online-job/joudi/ على GitHub Pages)
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("vite/preload-helper") || id.includes("commonjsHelpers")) return "react";
          if (!id.includes("node_modules")) return;
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (/[\\/]three[\\/]/.test(id)) return "three";
          if (/@react-three|postprocessing|maath|three-stdlib|troika|zustand|its-fine|suspend-react|tunnel-rat|meshline|camera-controls|stats-gl|hls/.test(id)) return "r3f";
          if (/gsap|lenis|framer-motion|motion-dom|motion-utils/.test(id)) return "motion";
        },
      },
    },
  },
});
