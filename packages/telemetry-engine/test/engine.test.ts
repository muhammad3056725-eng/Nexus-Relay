import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  haversineKm,
  bearingDeg,
  compass8,
  spatialVector,
  formatDelta,
} from "../src/MathVector";
import { buildAdjacency, hopDistance } from "../src/GraphBFS";
import {
  clueMultiplier,
  baseSolveScore,
  proximityBonus,
  overclockMultiplier,
  totalScore,
  rankFor,
} from "../src/ScoringSystem";
import { Round, dailySeed } from "../src/StateMachine";
import { buildShareCard } from "../src/ShareEncoder";
import {
  decodeClue,
  type CluePack,
  type TelemetryRecord,
} from "@nexus-relay/shared-types";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "..", "public", "data", "v1");
const telemetry = JSON.parse(
  readFileSync(join(dataDir, "telemetry.json"), "utf8")
) as { records: TelemetryRecord[] };
const packRaw = JSON.parse(
  readFileSync(join(dataDir, "chunks", "pack_000.json"), "utf8")
) as CluePack;

const records = new Map(telemetry.records.map((r) => [r.id, r]));
const pack = new Map(
  Object.entries(packRaw.entities).map(([id, e]) => [Number(id), e])
);
const adjacency = buildAdjacency(packRaw);
const nameOf = (id: number): string => pack.get(id)!.name;
const idByName = (name: string): number =>
  [...pack.entries()].find(([, e]) => e.name === name)![0];

describe("MathVector", () => {
  test("haversine: London -> Paris is ~343 km, bearing SE", () => {
    const km = haversineKm(51.5, -0.12, 48.85, 2.35);
    expect(km).toBeGreaterThan(335);
    expect(km).toBeLessThan(355);
    expect(compass8(bearingDeg(51.5, -0.12, 48.85, 2.35))).toBe("SE");
  });

  test("era delta display matches the blueprint format", () => {
    expect(formatDelta(42)).toBe("+42 yrs");
    expect(formatDelta(-118)).toBe("-118 yrs");
    expect(formatDelta(0)).toBe("EXACT YEAR LOCK");
  });

  test("spatial vector: non-spatial side returns null", () => {
    const pyth = records.get(idByName("Pythagorean Theorem"))!;
    const apollo = records.get(idByName("Apollo 11"))!;
    expect(spatialVector(pyth, apollo)).toBeNull();
    const v = spatialVector(apollo, records.get(idByName("NASA"))!);
    expect(v).not.toBeNull();
    expect(v!.km).toBeGreaterThan(1000);
    expect(v!.km).toBeLessThan(1600);
  });
});

describe("ScoringSystem (Blueprint §2 formulas)", () => {
  test("clue multiplier runs 1.00 down to 0.55", () => {
    expect(clueMultiplier(0)).toBe(1.0);
    expect(clueMultiplier(5)).toBeCloseTo(0.55, 9);
    expect(baseSolveScore(6, 0)).toBe(1000);
    expect(baseSolveScore(3, 0)).toBe(500);
  });

  test("overclock multiplier runs 1.0x to 2.5x", () => {
    expect(overclockMultiplier(0)).toBe(1.0);
    expect(overclockMultiplier(3)).toBe(2.5);
  });

  test("proximity bonus sums distance and era drift", () => {
    const prox = proximityBonus([
      { spatial: { km: 2000 }, deltaYear: -40 },
      { spatial: null, deltaYear: 10 },
    ]);
    expect(prox).toBe(250 - (2 + 4 + 0 + 1));
  });

  test("ranks follow the blueprint table", () => {
    expect(rankFor(2600).title).toBe("Quantum Archivist");
    expect(rankFor(1000).title).toBe("Relay Technician");
    expect(rankFor(0).title).toBe("Static Listener");
    const t = totalScore({
      probesRemaining: 2,
      cluesTuned: 1,
      pings: [],
      bridges: 2,
    });
    expect(t.multiplier).toBe(2.0);
  });
});

describe("GraphBFS on the real starter graph", () => {
  test("Apollo 11 -> Neil Armstrong is a direct neighbour", () => {
    expect(
      hopDistance(adjacency, idByName("Apollo 11"), idByName("Neil Armstrong"))
        .hops
    ).toBe(1);
  });

  test("the graph is fully connected", () => {
    const apollo = idByName("Apollo 11");
    for (const id of records.keys()) {
      expect(hopDistance(adjacency, apollo, id).hops).not.toBeNull();
    }
  });
});

describe("Round (full game loop)", () => {
  test("tune, ping, solve, bridge, share", () => {
    const targetId = idByName("Apollo 11");
    const round = new Round({ targetId, records, pack, adjacency, roundNumber: 42 });
    const clue = round.tune("alpha", decodeClue);
    expect(clue.length).toBeGreaterThan(10);
    expect(round.probes).toBe(5);

    const miss = round.ping(idByName("ENIAC"));
    expect(miss.exact).toBe(false);
    expect(miss.deltaYear).toBe(1945 - 1969);
    expect(miss.hops).toBeGreaterThanOrEqual(1);

    const hit = round.ping(targetId);
    expect(hit.exact).toBe(true);
    expect(round.phase).toBe(3);
    expect(round.overclockBeams()).toHaveLength(3);

    expect(round.bridge(idByName("Neil Armstrong"))).toBe(true);
    expect(round.bridge(idByName("Neil Armstrong"))).toBe(false);

    const card = buildShareCard(round, nameOf);
    expect(card).toContain("NEXUS RELAY #042");
    expect(card).toContain("APOLLO 11");
    expect(card).toContain("Overclock Surge: ⚡");
    expect(card).toContain("nexusrelay.io/trace/042-");
    // Blueprint §2 example: the chain lists bridged nodes in link order.
    expect(card).toContain("🔗 Neil Armstrong");
  });

  test("probe exhaustion without a solve fails the round", () => {
    const round = new Round({
      targetId: idByName("Zeus"),
      records,
      pack,
      adjacency,
      roundNumber: 1,
    });
    for (const n of ["Chess", "Pizza", "Pong", "Jazz", "Sahara", "Thor"]) {
      round.ping(idByName(n));
    }
    expect(round.probes).toBe(0);
    expect(round.failed).toBe(true);
    expect(round.solved).toBe(false);
  });

  test("hardcore mode seals the relays", () => {
    const round = new Round({
      targetId: idByName("Zeus"),
      records,
      pack,
      adjacency,
      hardcore: true,
    });
    expect(() => round.tune("alpha", decodeClue)).toThrow(/HARDCORE/);
  });
});

describe("Daily seed", () => {
  test("is deterministic per UTC date", () => {
    expect(dailySeed("2026-11-26")).toBe(dailySeed("2026-11-26"));
    expect(dailySeed("2026-11-26")).not.toBe(dailySeed("2026-11-27"));
  });
});
