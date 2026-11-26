/**
 * NEXUS RELAY — shared types & constants (Blueprint §4).
 */

/** 24-byte telemetry record layout (telemetry.bin). */
export const TELEMETRY_RECORD = Object.freeze({
  size: 24,
  fields: [
    { name: "id", offset: 0, type: "uint32" },
    { name: "year", offset: 4, type: "int32" },
    { name: "lat", offset: 8, type: "float32" },
    { name: "lon", offset: 12, type: "float32" },
    { name: "dom", offset: 16, type: "uint8" },
    { name: "subdom", offset: 17, type: "uint8" },
    { name: "notability", offset: 18, type: "uint16" },
    { name: "cluster", offset: 20, type: "uint32" },
  ] as const,
});

/** One decoded telemetry record. lat/lon null => CONCEPTUAL / NON-SPATIAL. */
export interface TelemetryRecord {
  id: number;
  year: number;
  lat: number | null;
  lon: number | null;
  dom: number;
  subdom: number;
  notability: number;
  cluster: number;
}

export type ChannelKey = "alpha" | "beta" | "gamma" | "delta" | "epsilon";

export interface PackEdge {
  target_id: number;
  rel: string;
  weight: number;
}

/** One entity inside a clue/edge pack (Blueprint §4 chunks format). */
export interface PackEntity {
  name: string;
  sub: string;
  clues: Record<ChannelKey, string>;
  edges: PackEdge[];
}

export interface CluePack {
  chunk_id: number;
  entities: Record<string, PackEntity>;
}

export interface ShardEntity {
  id: number;
  name: string;
  sub: string;
  dom: number;
  alt: string[];
  matched_alias?: string;
}

export interface TrieShard {
  prefix: string;
  entities: ShardEntity[];
}

export interface DatasetManifest {
  version: string;
  generated_at: string;
  entity_count: number;
  edge_count: number;
  min_outgoing_edges: number;
  telemetry_sha256: string;
  telemetry_record_bytes: number;
  shards_count: number;
  packs_count: number;
  corpus: string;
  note?: string;
}

/** The 12 knowledge domains (Blueprint §4 distribution table). */
export const DOMAINS: Readonly<Record<number, { name: string; short: string }>> =
  Object.freeze({
    1: { name: "History & Historical Events", short: "History" },
    2: { name: "Geography & Landmarks", short: "Geo" },
    3: { name: "Science & Technology", short: "Tech" },
    4: { name: "Cinema & Television", short: "Cinema" },
    5: { name: "Biology & Nature", short: "Bio" },
    6: { name: "Music & Audio", short: "Music" },
    7: { name: "Literature & Print", short: "Lit" },
    8: { name: "Sports & Games", short: "Sport" },
    9: { name: "Art & Architecture", short: "Art" },
    10: { name: "Mythology & Philosophy", short: "Myth" },
    11: { name: "Space & Astronomy", short: "Space" },
    12: { name: "Cultural Inventions", short: "Culture" },
  });

/** Parent-cluster adjacency between domains (Domain Resonance axis). */
export const DOMAIN_ADJACENCY: Readonly<Record<number, number[]>> =
  Object.freeze({
    1: [10, 2, 9], 2: [1, 5], 3: [11, 12, 5], 4: [6, 9], 5: [2, 3],
    6: [4, 7], 7: [10, 6], 8: [12, 4], 9: [4, 1], 10: [7, 1],
    11: [3], 12: [3, 8],
  });

/** Notability tiers (Blueprint §5 Stage 2), index 0 = most famous. */
export const NOTABILITY_TIERS = Object.freeze([
  { min: 50000, name: "Household Icon" },
  { min: 35000, name: "Famous" },
  { min: 20000, name: "Notable" },
  { min: 10000, name: "Specialized" },
  { min: 4000, name: "Deep Cult" },
  { min: 0, name: "Extreme Obscurity" },
]);

export function notabilityTierIndex(score: number): number {
  for (let i = 0; i < NOTABILITY_TIERS.length; i++) {
    if (score >= NOTABILITY_TIERS[i].min) return i;
  }
  return NOTABILITY_TIERS.length - 1;
}

/** The five orthogonal Frequency Relays (Blueprint §2 Phase 1). */
export const CHANNELS: ReadonlyArray<{
  key: ChannelKey;
  label: string;
  axis: string;
}> = Object.freeze([
  { key: "alpha", label: "ALPHA", axis: "Era" },
  { key: "beta", label: "BETA", axis: "Space" },
  { key: "gamma", label: "GAMMA", axis: "Domain" },
  { key: "delta", label: "DELTA", axis: "Relational" },
  { key: "epsilon", label: "EPSILON", axis: "Trait" },
]);

/** Rank progression scale (Blueprint §2). */
export const RANKS = Object.freeze([
  { min: 2500, title: "Quantum Archivist", frame: "Solar Gold Glitch-Prism" },
  { min: 2000, title: "Deep-Band Oracle", frame: "Imperial Amethyst" },
  { min: 1500, title: "Signal Cryptographer", frame: "Cobalt Anodized" },
  { min: 1000, title: "Relay Technician", frame: "Polished Copper" },
  { min: 500, title: "Frequency Scout", frame: "Brushed Steel" },
  { min: 0, title: "Static Listener", frame: "Raw Iron" },
]);

export interface Rank {
  min: number;
  title: string;
  frame: string;
}
