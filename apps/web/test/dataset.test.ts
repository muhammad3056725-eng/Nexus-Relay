/**
 * Dataset v2 gate: schema, leakage (no clue names its answer), unique
 * ids/names, balanced categories, and the committed index is current.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORIES,
  buildIndex,
  leakProblems,
  makeResolver,
  validateSubjects,
} from "../../../scripts/data/v2lib.mjs";
import type { Subject } from "../src/game/types";

const dataDir = join(__dirname, "..", "..", "..", "public", "data", "v2");
const subjects: Subject[] = readdirSync(join(dataDir, "subjects"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(join(dataDir, "subjects", f), "utf8")).subjects as Subject[]);

describe("dataset v2", () => {
  test("has at least 600 subjects across every category", () => {
    expect(subjects.length).toBeGreaterThanOrEqual(600);
    for (const c of CATEGORIES) {
      expect(subjects.filter((s) => s.category === c.id).length, c.id).toBeGreaterThanOrEqual(40);
    }
  });

  test("validates with zero errors", () => {
    const { errors } = validateSubjects(subjects);
    expect(errors).toEqual([]);
  });

  test("no clue leaks its answer (name, alias or obvious root)", () => {
    const leaks = subjects.flatMap((s) => leakProblems(s).map((p: string) => `${s.id}: ${p}`));
    expect(leaks).toEqual([]);
  });

  test("leakage audit catches roots and phrases", () => {
    const base = { aliases: [], clues: ["x".repeat(20)] };
    expect(leakProblems({ ...base, name: "Italy", clues: ["An Italian boot-shaped country"] }).length).toBeGreaterThan(0);
    expect(leakProblems({ ...base, name: "Paris", clues: ["Home of every Parisian cafe"] }).length).toBeGreaterThan(0);
    expect(leakProblems({ ...base, name: "The Beatles", clues: ["Each Beatle wore a suit"] }).length).toBeGreaterThan(0);
    expect(leakProblems({ ...base, name: "Golden Gate Bridge", clues: ["A suspension bridge in fog"] })).toEqual([]);
    expect(leakProblems({ ...base, name: "Queen", clues: ["A queen of rock"] }).length).toBeGreaterThan(0);
  });

  test("every subject has 5 clues and 1-3 links; plenty of people", () => {
    for (const s of subjects) {
      expect(s.clues).toHaveLength(5);
      expect(s.links.length).toBeGreaterThanOrEqual(1);
      expect(s.links.length).toBeLessThanOrEqual(3);
    }
    const peopleCats = ["stars", "music", "minds"];
    expect(subjects.filter((s) => peopleCats.includes(s.category)).length).toBeGreaterThanOrEqual(150);
  });

  test("most links resolve to other dataset subjects", () => {
    const resolve = makeResolver(subjects);
    const all = subjects.flatMap((s) => s.links);
    const ok = all.filter((l) => resolve(l.name)).length;
    expect(ok / all.length).toBeGreaterThan(0.6);
  });

  test("committed index.json matches the subject files", () => {
    const onDisk = JSON.parse(readFileSync(join(dataDir, "index.json"), "utf8"));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildIndex(subjects))));
  });
});
