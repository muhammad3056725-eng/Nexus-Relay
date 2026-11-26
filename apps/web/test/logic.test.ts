/** Game rules: scoring, distractors, daily determinism, the run state machine. */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CLUE_POINTS,
  SHARE_URL,
  buildLinkQuestion,
  buildOptions,
  dailyRng,
  pickDistractors,
  planRun,
  scoreRound,
  shareText,
  speedBonus,
  streakMultiplier,
  endlessNext,
} from "../src/game/logic";
import { mulberry32, dailyNumber } from "../src/game/rng";
import { Run } from "../src/game/session";
import type { DataIndex, Subject } from "../src/game/types";
import { words } from "../../../scripts/data/v2lib.mjs";

const dataDir = join(__dirname, "..", "..", "..", "public", "data", "v2");
const index: DataIndex = JSON.parse(readFileSync(join(dataDir, "index.json"), "utf8"));
const subjects = new Map<string, Subject>();
for (const f of readdirSync(join(dataDir, "subjects"))) {
  for (const s of JSON.parse(readFileSync(join(dataDir, "subjects", f), "utf8")).subjects as Subject[]) subjects.set(s.id, s);
}
const rows = index.subjects;
const cats = index.categories.map((c) => c.id);

describe("scoring", () => {
  test("clue points 500 → 100", () => {
    expect([...CLUE_POINTS]).toEqual([500, 400, 300, 200, 100]);
    expect(scoreRound(1, 20000, 1).total).toBe(500);
    expect(scoreRound(5, 20000, 1).total).toBe(100);
  });
  test("streak multiplier x1, x1.5, x2, x3", () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(streakMultiplier)).toEqual([1, 1.5, 1.5, 2, 2, 3, 3]);
    expect(scoreRound(2, 20000, 4).total).toBe(800);
  });
  test("speed bonus is small and fades", () => {
    expect(speedBonus(1000)).toBe(50);
    expect(speedBonus(9000)).toBe(25);
    expect(speedBonus(30000)).toBe(0);
    expect(speedBonus(1000, true)).toBe(100);
  });
});

describe("distractors", () => {
  test("3 unique same-category options, never the answer, mostly same sub", () => {
    const rng = mulberry32(1);
    let sameSub = 0;
    let total = 0;
    for (const row of rows) {
      const d = pickDistractors(row, rows, rng);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((r) => r.n)).size).toBe(3);
      for (const r of d) {
        expect(r.id).not.toBe(row.id);
        expect(r.c).toBe(row.c);
        if (r.s === row.s) sameSub++;
        total++;
      }
    }
    expect(sameSub / total).toBeGreaterThan(0.8);
  });
  test("buildOptions contains the answer once among 4", () => {
    const opts = buildOptions(rows[0], rows, mulberry32(3));
    expect(opts).toHaveLength(4);
    expect(opts.filter((id) => id === rows[0].id)).toHaveLength(1);
  });
});

describe("runs", () => {
  test("daily plan is identical for the same date and differs across dates", () => {
    const a = planRun(rows, cats, dailyRng("2026-11-26")).map((r) => r.id);
    const b = planRun(rows, cats, dailyRng("2026-11-26")).map((r) => r.id);
    const c = planRun(rows, cats, dailyRng("2026-11-27")).map((r) => r.id);
    expect(a).toHaveLength(10);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set(a).size).toBe(10);
    expect(new Set(planRun(rows, cats, dailyRng("2026-11-26")).map((r) => r.c)).size).toBe(10);
  });
  test("channel plan stays in its category", () => {
    const plan = planRun(rows, ["space"], mulberry32(5), { category: "space" });
    expect(plan).toHaveLength(10);
    expect(plan.every((r) => r.c === "space")).toBe(true);
  });
  test("daily number counts from 2026-01-01", () => {
    expect(dailyNumber("2026-01-01")).toBe(1);
    expect(dailyNumber("2026-11-26")).toBe(330);
  });
});

function newRun(mode: "quick" | "endless" = "quick", seed = 11): Run {
  const rng = mulberry32(seed);
  const plan = planRun(rows, cats, rng);
  return new Run({ mode, index: rows, rng, plan, rounds: mode === "endless" ? undefined : 10 });
}

describe("Run state machine", () => {
  test("wrong pick greys the card and reveals the next clue; correct scores", () => {
    const run = newRun();
    const s = subjects.get(run.plannedNext()!.id)!;
    const r = run.startRound(s, 0);
    const wrong = r.options.find((id) => id !== s.id)!;
    expect(run.pick(wrong, 100)).toBe("wrong");
    expect(r.wrong.has(wrong)).toBe(true);
    expect(r.clue).toBe(2);
    expect(run.pick(wrong, 200)).toBe("ignored");
    expect(run.pick(s.id, 20000)).toBe("correct");
    expect(r.score!.total).toBe(400);
    expect(run.score).toBe(400);
    expect(run.streak).toBe(1);
  });
  test("round is never lost before the last clue; wrong on clue 5 misses", () => {
    const run = newRun();
    const s = subjects.get(run.plannedNext()!.id)!;
    const r = run.startRound(s, 0);
    for (let i = 0; i < 4; i++) run.nextClue(0);
    expect(r.clue).toBe(5);
    const wrong = r.options.find((id) => id !== s.id)!;
    expect(run.pick(wrong, 0)).toBe("missed");
    expect(r.phase).toBe("missed");
    expect(run.streak).toBe(0);
    expect(run.records[0].solved).toBe(false);
  });
  test("Jammer removes exactly two wrong cards, once per run", () => {
    const run = newRun();
    const s = subjects.get(run.plannedNext()!.id)!;
    run.startRound(s, 0);
    const removed = run.useJammer();
    expect(removed).toHaveLength(2);
    expect(removed).not.toContain(s.id);
    expect(run.liveOptions()).toHaveLength(2);
    expect(run.useJammer()).toEqual([]);
  });
  test("endless loses a life only on a missed round", () => {
    const run = newRun("endless");
    expect(run.lives).toBe(3);
    for (let k = 0; k < 3; k++) {
      const row = endlessNext(rows, run.roundNo, run.seen, run.rng)!;
      const s = subjects.get(row.id)!;
      const r = run.startRound(s, 0);
      for (let i = 0; i < 4; i++) run.nextClue(0);
      run.pick(r.options.find((id) => id !== s.id)!, 0);
    }
    expect(run.lives).toBe(0);
    expect(run.over).toBe(true);
  });
  test("link bonus: exactly one correct option that is a real link; +100, never a penalty", () => {
    let checked = 0;
    for (const s of [...subjects.values()].slice(0, 200)) {
      const q = buildLinkQuestion(s, rows, mulberry32(checked + 1));
      if (!q) continue;
      checked++;
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      expect(q.options.filter((o) => o === q.correct)).toHaveLength(1);
      const nk = (x: string) => words(x).join(" ");
      const linkNames = s.links.map((l) => nk(l.name));
      const correctRow = rows.find((r) => r.n === q.correct);
      expect(linkNames.includes(nk(q.correct)) || (correctRow?.a ?? []).some((a) => linkNames.includes(nk(a)))).toBe(true);
    }
    expect(checked).toBeGreaterThan(150);
    const run = newRun();
    const s = subjects.get(run.plannedNext()!.id)!;
    run.startRound(s, 0);
    run.pick(s.id, 0);
    const before = run.score;
    const q = run.round!.link!;
    run.answerLink(q.options.find((o) => o !== q.correct)!);
    expect(run.score).toBe(before);
  });
  test("share text has the grid and the game URL", () => {
    const text = shareText({
      mode: "daily",
      dailyNo: 330,
      score: 3450,
      bestStreak: 4,
      rounds: [
        { id: "a", name: "A", category: "x", solved: true, clue: 1, points: 500, link: true },
        { id: "b", name: "B", category: "x", solved: false, clue: 5, points: 0, link: null },
      ],
    });
    expect(text).toContain("Daily #330");
    expect(text).toContain("🟩⬛");
    expect(text).toContain(SHARE_URL);
    expect(SHARE_URL).toBe("https://muhammad3056725-eng.github.io/Nexus-Relay/");
  });
});
