/** Small deterministic PRNG utilities (daily runs must match worldwide). */

export type Rng = () => number;

/** mulberry32: fast 32-bit seeded PRNG returning [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string (e.g. the UTC date "2026-11-26"). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** "YYYY-MM-DD" for a Date in UTC. */
export function utcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const LAUNCH = Date.UTC(2026, 0, 1);

/** Daily Broadcast number: 1 on 2026-01-01 (UTC). */
export function dailyNumber(dateStr: string): number {
  const t = Date.parse(dateStr + "T00:00:00Z");
  return Math.floor((t - LAUNCH) / 86400000) + 1;
}
