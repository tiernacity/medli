import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Point workspace packages to source files for HMR during development
      "@medli/spec": resolve(__dirname, "../spec/src/index.ts"),
      "@medli/generator-procedural": resolve(
        __dirname,
        "../generators/procedural/src/index.ts"
      ),
      "@medli/generator-object": resolve(
        __dirname,
        "../generators/object/src/index.ts"
      ),
      "@medli/renderer-common": resolve(
        __dirname,
        "../renderers/common/src/index.ts"
      ),
      "@medli/renderer-svg": resolve(
        __dirname,
        "../renderers/svg/src/index.ts"
      ),
      "@medli/renderer-canvas": resolve(
        __dirname,
        "../renderers/canvas/src/index.ts"
      ),
    },
  },
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
