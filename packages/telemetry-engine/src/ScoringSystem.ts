/**
 * NEXUS RELAY — deterministic scoring (Blueprint §2, exact formulas).
 *
 * Base Solve Score = 1000 * (P_remaining / 6) * M_clues
 *   M_clues = 1.00 - 0.09 * N_clues_tuned        (1.00 .. 0.55)
 * Proximity Bonus  = max(0, 250 - Σ (Distance_i/1000 + |ΔYear_i|/10))
 *   (non-spatial pings contribute 0 km — the ping simply has no
 *    spatial term, per the CONCEPTUAL / NON-SPATIAL axis rule)
 * Overclock        = 1.0 + 0.5 * B_valid        (1.0x .. 2.5x)
 * Total            = round((Base + Proximity) * Overclock)
 */
import { RANKS, type Rank } from "@nexus-relay/shared-types";

export const MAX_PROBES = 6;

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
