#!/usr/bin/env node
// Serves the built game exactly like GitHub Pages does:
//   /Nexus-Relay/            -> apps/web/dist/
//   /Nexus-Relay/public/...  -> repo public/ (copied to dist/public on Pages)
// Usage: node scripts/serve-dist.mjs [port]   (default 4173)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "apps", "web", "dist");
const pub = resolve(root, "public");
const port = Number(process.argv[2] ?? 4173);
const BASE = "/Nexus-Relay/";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

createServer((req, res) => {
  let url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (url === "/" || url === "/Nexus-Relay") {
    res.writeHead(302, { Location: BASE });
    res.end();
    return;
  }
  if (!url.startsWith(BASE)) {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<h1>404</h1>");
    return;
  }
  url = url.slice(BASE.length);
  let base = dist;
  if (url.startsWith("public/")) {
    base = pub;
    url = url.slice("public/".length);
  }
  let file = resolve(base, url || "index.html");
  if (!file.startsWith(base + sep) && file !== base) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    // Like Pages: an HTML 404 page (the data loader must reject it).
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<h1>404</h1>");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`NEXUS RELAY: http://localhost:${port}${BASE}`));
