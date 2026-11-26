/**
 * NEXUS RELAY — one run (a Daily, Quick Play, Channel or Endless
 * session) as a small state machine. Pure logic: the UI calls these
 * methods and re-renders from the state.
 */
import {
  ENDLESS_LIVES,
  buildLinkQuestion,
  buildOptions,
  scoreRound,
  LINK_BONUS,
  type LinkQuestion,
  type RoundRecord,
  type RoundScore,
} from "./logic";
import { shuffle, type Rng } from "./rng";
import type { IndexRow, Mode, Subject } from "./types";

export type RoundPhase = "guessing" | "solved" | "missed";

export interface RoundState {
  subject: Subject;
  options: string[]; // index ids, display order
  clue: number; // 1..5 clues revealed
  wrong: Set<string>; // picked and wrong (greyed out)
  jammed: Set<string>; // removed by the 50/50 Jammer
  phase: RoundPhase;
  score: RoundScore | null;
  clueShownAt: number;
  link: LinkQuestion | null;
  linkAnswer: string | null;
}

export interface RunOptions {
  mode: Mode;
  index: readonly IndexRow[];
  rng: Rng;
  turbo?: boolean;
  /** Planned subjects (daily/quick/channel/tutorial). Endless uses nextSubject. */
  plan?: IndexRow[];
  rounds?: number;
  lives?: number;
}

export class Run {
  readonly mode: Mode;
  readonly index: readonly IndexRow[];
  readonly rng: Rng;
  readonly turbo: boolean;
  readonly plan: IndexRow[];
  readonly totalRounds: number | null; // null = endless
  score = 0;
  streak = 0;
  bestStreak = 0;
  lives: number;
  jammerLeft = 1;
  roundNo = 0; // 1-based once a round starts
  round: RoundState | null = null;
  readonly records: RoundRecord[] = [];
  readonly seen = new Set<string>();

  constructor(opts: RunOptions) {
    this.mode = opts.mode;
    this.index = opts.index;
    this.rng = opts.rng;
    this.turbo = !!opts.turbo;
    this.plan = opts.plan ?? [];
    this.totalRounds = opts.mode === "endless" ? null : opts.rounds ?? this.plan.length;
    this.lives = opts.mode === "endless" ? opts.lives ?? ENDLESS_LIVES : Infinity;
  }

  get over(): boolean {
    if (this.round && this.round.phase === "guessing") return false;
    if (this.mode === "endless") return this.lives <= 0;
    return this.totalRounds != null && this.roundNo >= this.totalRounds;
  }

  get multiplierStreak(): number {
    return this.streak;
  }

  rowOf(id: string): IndexRow {
    const r = this.index.find((x) => x.id === id);
    if (!r) throw new Error(`unknown subject ${id}`);
    return r;
  }

  /** Start the next round with a fully loaded subject. */
  startRound(subject: Subject, now: number, fixedOptions?: string[]): RoundState {
    this.roundNo += 1;
    this.seen.add(subject.id);
    const row = this.rowOf(subject.id);
    this.round = {
      subject,
      options: fixedOptions ?? buildOptions(row, this.index, this.rng),
      clue: 1,
      wrong: new Set(),
      jammed: new Set(),
      phase: "guessing",
      score: null,
      clueShownAt: now,
      link: null,
      linkAnswer: null,
    };
    return this.round;
  }

  /** Planned subject id for the next round (non-endless). */
  plannedNext(): IndexRow | null {
    return this.plan[this.roundNo] ?? null;
  }

  /** Reveal one more clue (free, it just lowers the points on offer). */
  nextClue(now: number): boolean {
    const r = this.round;
    if (!r || r.phase !== "guessing" || r.clue >= 5) return false;
    r.clue += 1;
    r.clueShownAt = now;
    return true;
  }

  /** Remaining selectable options. */
  liveOptions(): string[] {
    const r = this.round;
    if (!r) return [];
    return r.options.filter((id) => !r.wrong.has(id) && !r.jammed.has(id));
  }

  /**
   * Pick an option. Correct → solved. Wrong → that card greys out and
   * the next clue arrives; a wrong pick on the last clue ends the round.
   */
  pick(id: string, now: number): "correct" | "wrong" | "missed" | "ignored" {
    const r = this.round;
    if (!r || r.phase !== "guessing") return "ignored";
    if (!r.options.includes(id) || r.wrong.has(id) || r.jammed.has(id)) return "ignored";
    if (id === r.subject.id) {
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      r.score = scoreRound(r.clue, now - r.clueShownAt, this.streak, this.turbo);
      this.score += r.score.total;
      r.phase = "solved";
      r.link = buildLinkQuestion(r.subject, this.index, this.rng);
      this.record(true);
      return "correct";
    }
    r.wrong.add(id);
    if (r.clue >= 5) {
      this.miss();
      return "missed";
    }
    r.clue += 1;
    r.clueShownAt = now;
    return "wrong";
  }

  /** Turbo timer ran out on the current clue. */
  timeout(now: number): "next" | "missed" | "ignored" {
    const r = this.round;
    if (!r || r.phase !== "guessing") return "ignored";
    if (r.clue >= 5) {
      this.miss();
      return "missed";
    }
    this.nextClue(now);
    return "next";
  }

  private miss(): void {
    const r = this.round!;
    r.phase = "missed";
    this.streak = 0;
    if (this.mode === "endless") this.lives -= 1;
    this.record(false);
  }

  /** 50/50 Jammer: once per run, removes two wrong options. */
  useJammer(): string[] {
    const r = this.round;
    if (!r || r.phase !== "guessing" || this.jammerLeft <= 0) return [];
    const wrongLive = this.liveOptions().filter((id) => id !== r.subject.id);
    if (wrongLive.length < 2) return [];
    const removed = shuffle(wrongLive, this.rng).slice(0, 2);
    removed.forEach((id) => r.jammed.add(id));
    this.jammerLeft -= 1;
    return removed;
  }

  /** Bonus link answer. Never a penalty. Returns true if correct. */
  answerLink(option: string): boolean {
    const r = this.round;
    if (!r || r.phase !== "solved" || !r.link || r.linkAnswer != null) return false;
    r.linkAnswer = option;
    const ok = option === r.link.correct;
    if (ok) this.score += LINK_BONUS;
    const rec = this.records[this.records.length - 1];
    if (rec) {
      rec.link = ok;
      if (ok) rec.points += LINK_BONUS;
    }
    return ok;
  }

  private record(solved: boolean): void {
    const r = this.round!;
    this.records.push({
      id: r.subject.id,
      name: r.subject.name,
      category: r.subject.category,
      solved,
      clue: r.clue,
      points: r.score?.total ?? 0,
      link: null,
    });
  }
}
