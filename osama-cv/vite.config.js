import { defineConfig } from "vite";

// base نسبي: الموقع بيشتغل من أي مسار (مثلاً /online-job/osama/)
export default defineConfig({
  base: "./",
  build: { outDir: "dist" },
});
