/**
 * NEXUS RELAY — deterministic scoring (Blueprint §2 formulas).
 *
 * Base Solve Score = 1000 * (P_remaining / MAX) * M_clues
 *   M_clues = 1.00 - 0.09 * N_clues_tuned        (1.00 .. 0.55)
 * Proximity Bonus  = max(0, 250 - Σ (Distance_i/1000 + |ΔYear_i|/10))
 *   (non-spatial pings contribute 0 km — the ping simply has no
 *    spatial term, per the CONCEPTUAL / NON-SPATIAL axis rule)
 * Overclock        = 1.0 + 0.5 * B_valid        (1.0x .. 2.5x)
 * Total            = round((Base + Proximity) * Overclock)
 *
 * OWNER-DIRECTED DEVIATION (Nov 26, 2026 — casual rebuild): the
 * blueprint's 6-probe economy becomes a 10-GUESS economy on the
 * player-facing surface ("Simplify it — make it casual and fun").
 * The formula's SHAPE is unchanged — only the denominator moved:
 * Base = 1000 * (guesses left / 10) * M_clues. Every other constant
 * (1000 base, 250 proximity cap, x0.5/link, rank table) is untouched,
 * so scores and ranks stay directly comparable with the 6-probe era:
 * a solve with 4 guesses to spare scores the same base as a solve
 * with 4 probes to spare used to, and fast solves score higher.
 */
import { RANKS, type Rank } from "@nexus-relay/shared-types";

/** Guesses per round (owner-directed casual economy — see header). */
export const MAX_PROBES = 10;

export function clueMultiplier(cluesTuned: number): number {
  return 1.0 - 0.09 * cluesTuned;
}

export function baseSolveScore(probesRemaining: number, cluesTuned: number): number {
  return 1000 * (probesRemaining / MAX_PROBES) * clueMultiplier(cluesTuned);
}

export interface PingLike {
  spatial: { km: number } | null;
  deltaYear: number;
}

export function proximityBonus(pings: readonly PingLike[]): number {
  let sum = 0;
  for (const p of pings) {
    const dist = p.spatial ? p.spatial.km : 0;
    sum += dist / 1000 + Math.abs(p.deltaYear) / 10;
  }
  return Math.max(0, 250 - sum);
}

export function overclockMultiplier(validBridges: number): number {
  return 1.0 + 0.5 * Math.min(3, Math.max(0, validBridges));
}

export interface ScoreBreakdown {
  base: number;
  proximity: number;
  multiplier: number;
  total: number;
}

export function totalScore(input: {
  probesRemaining: number;
  cluesTuned: number;
  pings: readonly PingLike[];
  bridges: number;
}): ScoreBreakdown {
  const base = baseSolveScore(input.probesRemaining, input.cluesTuned);
  const prox = proximityBonus(input.pings);
  const mult = overclockMultiplier(input.bridges);
  return {
    base: Math.round(base),
    proximity: Math.round(prox),
    multiplier: mult,
    total: Math.round((base + prox) * mult),
  };
}

export function rankFor(score: number): Rank {
  for (const r of RANKS) if (score >= r.min) return { ...r };
  const last = RANKS[RANKS.length - 1];
  return { ...last };
}
