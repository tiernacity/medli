import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    include: [
      "@medli/spec",
      "@medli/generator-procedural",
      "@medli/generator-object",
      "@medli/renderer-svg",
      "@medli/renderer-canvas",
    ],
  },
});
