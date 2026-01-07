import { defineConfig } from "vite";

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
});
