import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  optimizeDeps: {
    // Exclude workspace packages from pre-bundling so changes are reflected immediately
    exclude: [
      "@medli/spec",
      "@medli/generator-procedural",
      "@medli/generator-object",
      "@medli/renderer-common",
      "@medli/renderer-svg",
      "@medli/renderer-canvas",
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "full-screen": resolve(__dirname, "full-screen.html"),
      },
    },
  },
});
