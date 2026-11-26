/**
 * NEXUS RELAY — 3-phase round controller (Blueprint §2).
 *
 * Phase 1 SIGNAL INTERCEPTION: target sealed, 5 relays locked.
 * Phase 2 TRIANGULATION: 6 probes; Tune a Relay OR Ping a Hypothesis.
 * Phase 3 OVERCLOCK SURGE: 15 s to name connected nodes (chain-bridging).
 *
 * Pure logic, zero UI dependencies. Records come from telemetry data;
 * names/clues/edges come from the clue pack.
 */
import { eraDelta, spatialVector, type SpatialResult } from "./MathVector";
import { hopDistance, type Adjacency } from "./GraphBFS";
import { totalScore, rankFor, MAX_PROBES, type ScoreBreakdown } from "./ScoringSystem";
import {
  DOMAIN_ADJACENCY,
  DOMAINS,
  notabilityTierIndex,
  NOTABILITY_TIERS,
  type ChannelKey,
  type PackEntity,
  type Rank,
  type TelemetryRecord,
} from "@nexus-relay/shared-types";

export function domainResonance(
  guess: TelemetryRecord,
  target: TelemetryRecord
): string {
  if (guess.dom === target.dom && guess.subdom === target.subdom)
    return "EXACT MATCH";
  if (guess.dom === target.dom) return "SAME SECTOR";
  const adj = DOMAIN_ADJACENCY[guess.dom] ?? [];
  if (adj.includes(target.dom)) return "ADJACENT DISCIPLINE";
  return "ORTHOGONAL FIELD";
}

export interface NotabilityResult {
  label: string;
  tier: string;
}

export function notabilityMatch(
  guess: TelemetryRecord,
  target: TelemetryRecord
): NotabilityResult {
  const g = notabilityTierIndex(guess.notability);
  const t = notabilityTierIndex(target.notability);
  if (g === t) return { label: "SAME TIER", tier: NOTABILITY_TIERS[t].name };
  if (Math.abs(g - t) === 1)
    return {
      label:
        t > g
          ? "NEAR TIER — TARGET MORE OBSCURE"
          : "NEAR TIER — TARGET MORE FAMOUS",
      tier: NOTABILITY_TIERS[t].name,
    };
  return {
    label: t > g ? "FAR TIER — PIVOT TO OBSCURE" : "FAR TIER — PIVOT TO FAMOUS",
    tier: NOTABILITY_TIERS[t].name,
  };
}

/** Deterministic daily selection: FNV-1a hash of the UTC date string. */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export interface PingResult {
  guessId: number;
  name: string;
  deltaYear: number;
  spatial: SpatialResult | null;
  resonance: string;
  hops: number | null;
  via: string | null;
  notability: string;
  domainShort: string;
  year: number;
  exact: boolean;
}

export interface Beam {
  rel: string;
  targetId: number;
}

export interface RoundConfig {
  targetId: number;
  records: Map<number, TelemetryRecord>;
  pack: Map<number, PackEntity>;
  adjacency: Adjacency;
  roundNumber?: number;
  hardcore?: boolean;
}

export class Round {
  readonly targetId: number;
  readonly records: Map<number, TelemetryRecord>;
  readonly pack: Map<number, PackEntity>;
  readonly adjacency: Adjacency;
  readonly roundNumber: number;
  readonly hardcore: boolean;
  phase: 1 | 2 | 3 = 1;
  probes: number = MAX_PROBES;
  readonly tuned = new Set<ChannelKey>();
  readonly pings: PingResult[] = [];
  readonly bridges: number[] = [];
  solved = false;
  failed = false;
  readonly startedAt = Date.now();

  constructor(cfg: RoundConfig) {
    this.targetId = cfg.targetId;
    this.records = cfg.records;
    this.pack = cfg.pack;
    this.adjacency = cfg.adjacency;
    this.roundNumber = cfg.roundNumber ?? 1;
    this.hardcore = cfg.hardcore ?? false;
  }

  get target(): TelemetryRecord {
    return this.records.get(this.targetId)!;
  }

  get targetPack(): PackEntity {
    return this.pack.get(this.targetId)!;
  }

  /** Action A — Tune a Relay. Returns the decrypted clue text. */
  tune(channelKey: ChannelKey, decodeClue: (hex: string) => string): string {
    if (this.phase === 3) throw new Error("round over");
    if (this.hardcore) throw new Error("HARDCORE: relays are sealed");
    if (this.tuned.has(channelKey)) throw new Error("relay already tuned");
    if (this.probes <= 0) throw new Error("no probes left");
    this.phase = 2;
    this.probes -= 1;
    this.tuned.add(channelKey);
    if (this.probes === 0) this.failed = true;
    return decodeClue(this.targetPack.clues[channelKey]);
  }

  /** Action B — Ping a Hypothesis. Returns the 5-axis telemetry object. */
  ping(guessId: number): PingResult {
    if (this.phase === 3) throw new Error("round over");
    if (this.probes <= 0) throw new Error("no probes left");
    const guessPack = this.pack.get(guessId)!;
    if (guessId === this.targetId) {
      this.phase = 2;
      this.probes -= 1;
      this.solved = true;
      const hit: PingResult = {
        guessId,
        name: guessPack.name,
        deltaYear: 0,
        spatial: { km: 0, bearing: null, label: "TARGET LOCK" },
        resonance: "EXACT MATCH",
        hops: 0,
        via: null,
        notability: "SAME TIER",
        domainShort: DOMAINS[this.target.dom].short,
        year: this.target.year,
        exact: true,
      };
      this.pings.push(hit);
      this.phase = 3;
      return hit;
    }
    this.phase = 2;
    this.probes -= 1;
    const guess = this.records.get(guessId)!;
    const target = this.target;
    const hops = hopDistance(this.adjacency, guessId, this.targetId);
    const result: PingResult = {
      guessId,
      name: guessPack.name,
      deltaYear: eraDelta(guess.year, target.year),
      spatial: spatialVector(guess, target),
      resonance: domainResonance(guess, target),
      hops: hops.hops,
      via: hops.via != null ? this.pack.get(hops.via)!.name : null,
      notability: notabilityMatch(guess, target).label,
      domainShort: DOMAINS[guess.dom].short,
      year: guess.year,
      exact: false,
    };
    this.pings.push(result);
    if (this.probes === 0) this.failed = true;
    return result;
  }

  /** Phase 3 — name a connected entity. Returns true when valid & new. */
  bridge(guessId: number): boolean {
    if (this.phase !== 3 || !this.solved) return false;
    if (this.bridges.includes(guessId)) return false;
    if (guessId === this.targetId) return false;
    // Valid = a connected node: directly linked to the target, or linked
    // to an already-bridged node (Overclock Chain-Bridging, Blueprint §1/§2).
    const reachable = new Set(
      (this.targetPack.edges ?? []).map((e) => e.target_id)
    );
    for (const b of this.bridges) {
      for (const e of this.pack.get(b)?.edges ?? []) reachable.add(e.target_id);
    }
    if (!reachable.has(guessId)) return false;
    this.bridges.push(guessId);
    return true;
  }

  /** The 3 outgoing beams shown at Overclock start (rel-labelled). */
  overclockBeams(): Beam[] {
    return (this.targetPack.edges ?? []).slice(0, 3).map((e) => ({
      rel: e.rel,
      targetId: e.target_id,
    }));
  }

  score(): ScoreBreakdown & { rank: Rank } {
    const s = totalScore({
      probesRemaining: this.probes,
      cluesTuned: this.tuned.size,
      pings: this.pings.filter((p) => !p.exact),
      bridges: this.bridges.length,
    });
    return { ...s, rank: rankFor(s.total) };
  }
}
