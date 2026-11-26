import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

/**
 * NEXUS RELAY web app.
 *
 * Production: the built app (dist/) is deployed with the repo's
 * public/ folder copied beside it as dist/public/ — see
 * .github/workflows/pages.yml — so the dataset lives at
 * <app>/public/data/v2/. Development: the plugin below serves the
 * repo's public/ folder at the same relative path (/public/…), so dev
 * and production resolve the dataset identically.
 */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const publicRoot = resolve(repoRoot, "public");

const MIME: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function dataMount(): Plugin {
  return {
    name: "nexus-public-mount",
    configureServer(server) {
      server.middlewares.use("/public", (req, res, next) => {
        const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const path = resolve(join(publicRoot, urlPath));
        // Path-traversal guard: never serve outside public/.
        if (!path.startsWith(publicRoot + sep)) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (!existsSync(path) || !statSync(path).isFile()) {
          next();
          return;
        }
        res.setHeader("Content-Type", MIME[extname(path)] ?? "application/octet-stream");
        createReadStream(path).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Relative asset URLs: the same dist/ works at a domain root, on the
  // GitHub Pages project URL (/Nexus-Relay/) or under any subpath.
  base: process.env.VITE_BASE ?? "./",
  publicDir: false,
  // Keep paths as given (mapped / subst drives on Windows).
  resolve: { preserveSymlinks: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2020" },
  server: { port: 5173, fs: { allow: [repoRoot] } },
  plugins: [dataMount()],
});
