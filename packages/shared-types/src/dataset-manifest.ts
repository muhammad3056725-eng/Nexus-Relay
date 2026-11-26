/**
 * NEXUS RELAY — dataset manifest helpers (Blueprint §4 Stage 6, §7).
 *
 * The data set is served statically. Candidate bases cover the
 * supported layouts:
 *   <document-anchored>     — "public/data/v1" resolved against
 *                             document.baseURI at runtime, so the built
 *                             app finds its dataset at a domain root,
 *                             on a project-pages URL, and under a
 *                             subpath of a shared domain
 *                             (e.g. deepwell.games/nexus-relay/)
 *   "./public/data/v1"      — built app with public/ copied beside it
 *                             (GitHub Pages workflow / Cloudflare Pages)
 *   "../../public/data/v1"  — repository-root static serving
 *   "/__data/data/v1"       — Vite dev middleware mount (vite.config.ts)
 */
import type { DatasetManifest } from "./binary-schema";

export const DATA_BASE_CANDIDATES: readonly string[] = [
  "./public/data/v1",
  "../../public/data/v1",
  "/__data/data/v1",
];

let resolvedBase: string | null = null;

export async function resolveDataBase(
  candidates: readonly string[] = DATA_BASE_CANDIDATES
): Promise<string> {
  if (resolvedBase) return resolvedBase;
  const effective: string[] = [];
  // Document-anchored base first: resolving "public/data/v1" against
  // the page's own URL makes the dataset follow the app wherever it is
  // mounted — domain root, project-pages URL, or a subpath of a shared
  // domain (deepwell.games/nexus-relay/). No build-time configuration.
  if (typeof document !== "undefined" && document.baseURI) {
    try {
      effective.push(
        new URL("public/data/v1", document.baseURI).href.replace(/\/$/, "")
      );
    } catch {
      /* fall through to the static candidates */
    }
  }
  effective.push(...candidates);
  for (const base of effective) {
    try {
      const res = await fetch(`${base}/manifest.json`);
      if (res.ok) {
        resolvedBase = base;
        return base;
      }
    } catch {
      /* try next candidate */
    }
  }
  throw new Error("dataset manifest not found under any candidate base");
}

export async function loadManifest(base: string): Promise<DatasetManifest> {
  const res = await fetch(`${base}/manifest.json`);
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return (await res.json()) as DatasetManifest;
}

/** Decode one hex-encoded clue string (Blueprint §4 pack format). */
export function decodeClue(hex: string): string {
  const pairs = hex.match(/.{2}/g) ?? [];
  const bytes = new Uint8Array(pairs.map((h) => parseInt(h, 16)));
  return new TextDecoder().decode(bytes);
}

/** 2-character trie shard prefix for a typed query (Blueprint §4). */
export function shardPrefix(text: string): string | null {
  const norm = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!norm) return null;
  if (/^[0-9]/.test(norm)) return "00";
  if (norm.length === 1) return norm + "_";
  return norm.slice(0, 2);
}
