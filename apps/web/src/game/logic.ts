/**
 * NEXUS RELAY — pure game rules (no DOM). Everything here is unit
 * tested in apps/web/test/logic.test.ts.
 */
import { words } from "../../../../scripts/data/v2lib.mjs";
import { hashString, mulberry32, shuffle, pick, type Rng } from "./rng";
import type { IndexRow, Subject, Mode } from "./types";

// ----------------------------------------------------------- scoring
/** Points for a correct answer on clue 1..5. */
export const CLUE_POINTS = [500, 400, 300, 200, 100] as const;
export const LINK_BONUS = 100;
export const ROUNDS_PER_RUN = 10;
export const ENDLESS_LIVES = 3;
export const TURBO_SECONDS = 20;

export function cluePoints(clue: number): number {
  return CLUE_POINTS[Math.max(1, Math.min(5, clue)) - 1];
}

/** Combo multiplier for a streak of consecutive solved rounds. */
export function streakMultiplier(streak: number): number {
  if (streak >= 6) return 3;
  if (streak >= 4) return 2;
  if (streak >= 2) return 1.5;
  return 1;
}

/** Next multiplier tier threshold, for the UI ("2 more for ×2"). */
export function nextTier(streak: number): { at: number; mult: number } | null {
  for (const [at, mult] of [[2, 1.5], [4, 2], [6, 3]] as const) {
    if (streak < at) return { at, mult };
  }
  return null;
}

/**
 * Small speed bonus: full within 4 s of the clue appearing, fading to
 * 0 at 14 s. Max 50 (Turbo doubles it to 100).
 */
export function speedBonus(ms: number, turbo = false): number {
  const max = turbo ? 100 : 50;
  if (ms <= 4000) return max;
  if (ms >= 14000) return 0;
  return Math.round(max * (1 - (ms - 4000) / 10000));
}

export interface RoundScore {
  base: number;
  speed: number;
  multiplier: number;
  total: number;
}

export function scoreRound(clue: number, ms: number, streakAfter: number, turbo = false): RoundScore {
  const base = cluePoints(clue);
  const speed = speedBonus(ms, turbo);
  const multiplier = streakMultiplier(streakAfter);
  return { base, speed, multiplier, total: Math.round((base + speed) * multiplier) };
}

// ------------------------------------------------------- distractors
/**
 * Pick 3 plausible wrong answers: same category, preferring the same
 * subcategory, a similar era and difficulty. Names are always distinct.
 */
export function pickDistractors(answer: IndexRow, index: readonly IndexRow[], rng: Rng): IndexRow[] {
  const used = new Set([norm(answer.n)]);
  const scored = index
    .filter((r) => r.c === answer.c && r.id !== answer.id)
    .map((r) => {
      let cost = r.s === answer.s ? 0 : 100;
      if (answer.y == null && r.y == null) cost += 0;
      else if (answer.y == null || r.y == null) cost += 25;
      else cost += Math.min(60, Math.abs(answer.y - r.y) / 15);
      cost += Math.abs(answer.d - r.d) * 6;
      cost += rng() * 45; // variety between plays
      return { r, cost };
    })
    .sort((a, b) => a.cost - b.cost);
  const out: IndexRow[] = [];
  for (const { r } of scored) {
    const k = norm(r.n);
    if (used.has(k)) continue;
    used.add(k);
    out.push(r);
    if (out.length === 3) break;
  }
  return out;
}

function norm(s: string): string {
  return words(s).join(" ");
}

/** Four option ids (answer + 3 distractors), shuffled. */
export function buildOptions(answer: IndexRow, index: readonly IndexRow[], rng: Rng): string[] {
  return shuffle([answer.id, ...pickDistractors(answer, index, rng).map((r) => r.id)], rng);
}

// ---------------------------------------------------- run selection
/** Difficulty plan for a 10-round run: gentle start, small peak. */
export const DIFFICULTY_PLAN: ReadonlyArray<1 | 2 | 3> = [1, 1, 1, 2, 1, 2, 2, 2, 3, 2];

function pickByDifficulty(
  pool: readonly IndexRow[],
  want: 1 | 2 | 3,
  taken: Set<string>,
  rng: Rng,
  prefer?: (r: IndexRow) => boolean
): IndexRow | null {
  for (const delta of [0, 1, -1, 2, -2]) {
    const d = want + delta;
    let cands = pool.filter((r) => r.d === d && !taken.has(r.id));
    if (prefer) {
      const preferred = cands.filter(prefer);
      if (preferred.length) cands = preferred;
    }
    if (cands.length) return pick(cands, rng);
  }
  return null;
}

/**
 * Choose the subjects for a 10-round run.
 *  - daily/quick: one subject from each of 10 different categories
 *  - channel: 10 subjects from one category
 * `prefer` lets Quick/Channel favour subjects the player has not
 * solved yet (the daily never uses it: it must match worldwide).
 */
export function planRun(
  index: readonly IndexRow[],
  categories: readonly string[],
  rng: Rng,
  opts: { category?: string; prefer?: (r: IndexRow) => boolean; rounds?: number } = {}
): IndexRow[] {
  const n = opts.rounds ?? ROUNDS_PER_RUN;
  const taken = new Set<string>();
  const out: IndexRow[] = [];
  const order = opts.category ? [] : shuffle(categories, rng);
  for (let i = 0; i < n; i++) {
    const want = DIFFICULTY_PLAN[i % DIFFICULTY_PLAN.length];
    const cat = opts.category ?? order[i % order.length];
    const pool = index.filter((r) => r.c === cat);
    const row =
      pickByDifficulty(pool, want, taken, rng, opts.prefer) ??
      pickByDifficulty(index, want, taken, rng, opts.prefer);
    if (!row) break;
    taken.add(row.id);
    out.push(row);
  }
  return out;
}

/** Endless: next subject; difficulty ramps with the round number. */
export function endlessNext(
  index: readonly IndexRow[],
  round: number,
  taken: Set<string>,
  rng: Rng,
  prefer?: (r: IndexRow) => boolean
): IndexRow | null {
  const want: 1 | 2 | 3 = round < 5 ? 1 : round < 12 ? (rng() < 0.6 ? 1 : 2) : rng() < 0.5 ? 2 : rng() < 0.6 ? 1 : 3;
  return pickByDifficulty(index, want, taken, rng, prefer);
}

/** Same 10 subjects for everyone on a given UTC date. */
export function dailySeed(dateStr: string): number {
  return hashString("nexus-relay-daily:" + dateStr);
}

export function dailyRng(dateStr: string): Rng {
  return mulberry32(dailySeed(dateStr));
}

// ------------------------------------------------------ link bonus
export interface LinkQuestion {
  answerName: string;
  rel: string;
  correct: string;
  options: string[];
}

/**
 * "Which of these is connected to <answer>?" — the correct option is
 * one of the subject's authored links; the two wrong options are
 * dataset names from a DIFFERENT region than the answer (so they are
 * very unlikely to be connected), preferring the link's own category
 * so the three options look alike.
 */
export function buildLinkQuestion(
  subject: Subject,
  index: readonly IndexRow[],
  rng: Rng
): LinkQuestion | null {
  if (!subject.links.length) return null;
  const byName = new Map<string, IndexRow>();
  for (const r of index) {
    byName.set(norm(r.n), r);
    for (const a of r.a ?? []) if (!byName.has(norm(a))) byName.set(norm(a), r);
  }
  const resolved = subject.links.map((l) => ({ l, row: byName.get(norm(l.name)) ?? null }));
  const withRow = resolved.filter((x) => x.row);
  const chosen = withRow.length ? pick(withRow, rng) : pick(resolved, rng);
  const correctName = chosen.row ? chosen.row.n : chosen.l.name;
  const linkedKeys = new Set(resolved.map((x) => norm(x.row ? x.row.n : x.l.name)));
  linkedKeys.add(norm(subject.name));
  const subjectRow = index.find((r) => r.id === subject.id);
  const region = subjectRow?.r ?? subject.region;
  const candidates = index.filter(
    (r) =>
      r.id !== subject.id &&
      !linkedKeys.has(norm(r.n)) &&
      r.r !== region &&
      (chosen.row ? r.r !== chosen.row.r || r.r === "Space" : true)
  );
  let pool = chosen.row ? candidates.filter((r) => r.c === chosen.row!.c && r.s === chosen.row!.s) : [];
  if (pool.length < 2 && chosen.row) pool = candidates.filter((r) => r.c === chosen.row!.c);
  // A link outside the dataset ("Sweden") with a place-like relation:
  // offer other countries / cities so the three options look alike.
  if (!chosen.row && /\b(in|from|born|located|country|city|capital|native|home|founded)\b/i.test(chosen.l.rel)) {
    pool = candidates.filter((r) => r.c === "places");
  }
  if (pool.length < 2) pool = candidates;
  const wrong = shuffle(pool, rng).slice(0, 2).map((r) => r.n);
  if (wrong.length < 2) return null;
  return {
    answerName: subject.name,
    rel: chosen.l.rel,
    correct: correctName,
    options: shuffle([correctName, ...wrong], rng),
  };
}

// ------------------------------------------------------------ share
export interface RoundRecord {
  id: string;
  name: string;
  category: string;
  solved: boolean;
  clue: number; // clue number when solved (or 5 when missed)
  points: number;
  link: boolean | null; // null = no bonus asked
}

export const SHARE_URL = "https://muhammad3056725-eng.github.io/Nexus-Relay/";

export function roundEmoji(r: RoundRecord): string {
  if (!r.solved) return "⬛";
  return ["🟩", "🟦", "🟨", "🟧", "🟥"][r.clue - 1] ?? "🟥";
}

export function shareText(opts: {
  mode: Mode;
  dailyNo?: number;
  score: number;
  rounds: RoundRecord[];
  bestStreak: number;
}): string {
  const title =
    opts.mode === "daily"
      ? `NEXUS RELAY Daily #${opts.dailyNo ?? 1}`
      : `NEXUS RELAY ${opts.mode === "endless" ? "Endless" : "Quick Play"}`;
  const grid: string[] = [];
  for (let i = 0; i < opts.rounds.length; i += 5) {
    grid.push(opts.rounds.slice(i, i + 5).map(roundEmoji).join(""));
  }
  const solved = opts.rounds.filter((r) => r.solved).length;
  const links = opts.rounds.filter((r) => r.link).length;
  return [
    `${title} · ${opts.score.toLocaleString("en-US")} pts`,
    ...grid,
    `✅ ${solved}/${opts.rounds.length} · 🔗 ${links} · 🔥 best streak ${opts.bestStreak}`,
    SHARE_URL,
  ].join("\n");
}

/** Mode labels in plain words. */
export const MODE_LABEL: Record<Mode, string> = {
  daily: "Daily Broadcast",
  quick: "Quick Play",
  channel: "Channel",
  endless: "Endless",
  tutorial: "Training",
};

export function seededRng(seed?: number): Rng {
  return mulberry32(seed ?? Math.floor(Math.random() * 2 ** 32));
}
