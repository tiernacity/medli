import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";

/**
 * Plugin to disable caching for frame.json (served from public/).
 * Enables the remote frame generator demo to show live updates.
 */
function noCacheFrameJson(): Plugin {
  return {
    name: "no-cache-frame-json",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/frame.json") {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [noCacheFrameJson()],
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
      "@medli/generator-remote": resolve(
        __dirname,
        "../generators/remote/src/index.ts"
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
      "@medli/generator-remote",
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
