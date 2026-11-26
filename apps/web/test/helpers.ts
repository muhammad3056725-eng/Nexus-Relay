/** Shared jsdom boot helper: serve public/ from disk through fetch. */
import { vi, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const repoRoot = join(__dirname, "..", "..", "..");

export function stubFetch(): void {
  vi.stubGlobal("fetch", async (url: string) => {
    const s = String(url);
    const idx = s.indexOf("/public/");
    const path = idx >= 0 ? join(repoRoot, "public", s.slice(idx + "/public/".length)) : "";
    if (!path || !existsSync(path)) {
      return { ok: false, status: 404, headers: { get: () => "text/html" }, json: async () => ({}) };
    }
    const buf = readFileSync(path, "utf8");
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => JSON.parse(buf),
    };
  });
}

export function mountBody(): void {
  const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script[\s\S]*?<\/script>/g, "");
}

export async function waitFor(fn: () => void, timeout = 5000): Promise<void> {
  await vi.waitFor(fn, { timeout, interval: 20 });
}

export const q = <T extends HTMLElement = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

export function expectVisible(sel: string): void {
  expect(q(sel), sel).not.toBeNull();
}
