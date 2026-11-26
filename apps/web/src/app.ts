/**
 * NEXUS RELAY — application controller: screens, input, rendering.
 *
 * Screens: home · channels · game · summary · archive · settings
 * (plus the daily-done card and the 30-second tutorial overlay).
 * Game rules live in game/session.ts + game/logic.ts; this file only
 * turns state into DOM and DOM events into rule calls.
 */
import { DataStore } from "./data";
import { Run } from "./game/session";
import {
  MODE_LABEL,
  ROUNDS_PER_RUN,
  TURBO_SECONDS,
  buildOptions,
  cluePoints,
  dailyRng,
  endlessNext,
  nextTier,
  planRun,
  seededRng,
  shareText,
  streakMultiplier,
  SHARE_URL,
} from "./game/logic";
import { dailyNumber, utcDate } from "./game/rng";
import type { IndexRow, Mode } from "./game/types";
import { loadSave, writeSave, clearSave, defaultSave, type SaveData } from "./save";
import { Sfx } from "./audio";
import { SignalSpace } from "./fx/space";
import { Confetti } from "./fx/confetti";
import { Vex, type Mood } from "./fx/vex";

type Screen = "loading" | "home" | "channels" | "game" | "summary" | "archive" | "settings" | "daily-done" | "error";

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const GREETINGS = [
  "Hi! I'm VEX-09. Mystery transmissions are coming in — want to decode one?",
  "Signals are strong today. Ready to guess some mysteries?",
  "Five clues, four answers, one mystery. Let's go!",
  "Every clue gets more obvious. You've totally got this.",
];

const TUTORIAL_ID = "pizza";

interface TutorialStep {
  text: string;
  target: string | null;
  wait?: "solve" | "link";
  button?: string;
}

const TUTORIAL: TutorialStep[] = [
  { text: "Hi, I'm VEX-09! A mystery is transmitting. Its clues start vague and get more obvious.", target: ".transmission", button: "Next" },
  { text: "These are your four answers. Tap one — or press 1-4 — whenever you think you know it. The earlier you're right, the more points you get.", target: ".answers", button: "Next" },
  { text: "Not sure yet? Tap Next clue. A wrong guess just greys out that card and brings the next clue — no game over.", target: ".actions", button: "Next" },
  { text: "Your turn: which one is it?", target: ".answers", wait: "solve" },
  { text: "Nice! Bonus round: pick the thing that's connected for +100.", target: ".result", wait: "link" },
  { text: "That's it! Get answers right in a row to multiply your points, up to ×3. Have fun!", target: null, button: "Let's play" },
];

export class App {
  ds: DataStore | null = null;
  save: SaveData = defaultSave();
  sfx = new Sfx();
  space: SignalSpace | null = null;
  confetti: Confetti | null = null;
  run: Run | null = null;
  screen: Screen = "loading";
  private root: HTMLElement;
  private live: HTMLElement;
  private vex: Vex | null = null;
  private turboTimer: number | null = null;
  private resultTimer: number | null = null;
  private busy = false;
  private channel: string | null = null;
  private tutorialStep = -1;
  private coach: HTMLElement | null = null;
  private lastShare = "";
  private newlyArchived = 0;
  private motionQuery: MediaQueryList | null = null;

  constructor() {
    this.root = document.getElementById("app")!;
    this.live = document.getElementById("sr-live")!;
  }

  // ------------------------------------------------------------ boot
  async boot(): Promise<void> {
    this.save = loadSave();
    try {
      this.motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
      this.motionQuery?.addEventListener?.("change", () => this.applySettings());
    } catch {
      this.motionQuery = null;
    }
    const spaceCanvas = document.getElementById("space") as HTMLCanvasElement | null;
    if (spaceCanvas) {
      this.space = new SignalSpace(spaceCanvas, {
        reducedMotion: this.reducedMotion(),
        quality: this.save.settings.quality,
      });
      document.body.dataset.gfx = this.space.mode;
    }
    const confettiCanvas = document.getElementById("confetti") as HTMLCanvasElement | null;
    if (confettiCanvas) this.confetti = new Confetti(confettiCanvas);
    this.applySettings();
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("change", (e) => this.onChange(e));
    document.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("resize", () => this.updateFocus());
    this.render("loading");
    try {
      this.ds = await DataStore.load();
    } catch {
      this.render("error");
      return;
    }
    if (!this.save.tutorialDone) void this.startTutorial();
    else this.render("home");
  }

  reducedMotion(): boolean {
    const s = this.save.settings.reducedMotion;
    if (s != null) return s;
    return !!this.motionQuery?.matches;
  }

  private applySettings(): void {
    const s = this.save.settings;
    this.sfx.sound = s.sound;
    this.sfx.setMusic(s.music && this.screen !== "loading");
    const rm = this.reducedMotion();
    document.body.classList.toggle("reduce-motion", rm);
    document.body.classList.toggle("motion-ok", s.reducedMotion === false);
    document.body.classList.toggle("contrast", s.contrast);
    this.space?.setReducedMotion(rm);
    this.space?.setQuality(s.quality);
    if (this.confetti) this.confetti.reduced = rm;
  }

  private persist(): void {
    writeSave(this.save);
  }

  private announce(text: string): void {
    this.live.textContent = "";
    window.setTimeout(() => (this.live.textContent = text), 30);
  }

  // ---------------------------------------------------------- render
  render(screen: Screen): void {
    this.screen = screen;
    this.clearTimers();
    document.body.dataset.screen = screen;
    const html =
      screen === "loading"
        ? this.loadingHtml()
        : screen === "error"
          ? this.errorHtml()
          : screen === "home"
            ? this.homeHtml()
            : screen === "channels"
              ? this.channelsHtml()
              : screen === "archive"
                ? this.archiveHtml()
                : screen === "settings"
                  ? this.settingsHtml()
                  : screen === "summary"
                    ? this.summaryHtml()
                    : screen === "daily-done"
                      ? this.dailyDoneHtml()
                      : this.gameHtml();
    this.root.innerHTML = html;
    const slot = $(".vex-slot", this.root);
    this.vex = slot ? new Vex(slot, slot.classList.contains("big") ? 150 : 84) : null;
    if (screen === "game") this.renderRound();
    if (screen === "summary") this.animateSummary();
    const h = $<HTMLElement>("[data-autofocus]", this.root) ?? $<HTMLElement>("h1, h2", this.root);
    if (h && screen !== "game") {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
    this.updateFocus();
    this.space?.setTint(screen === "summary" ? "magenta" : "cyan");
  }

  private updateFocus(): void {
    const anchor = $(".transmission", this.root) ?? $(".host", this.root) ?? $(".screen-head", this.root);
    if (!anchor || !this.space) return;
    const r = anchor.getBoundingClientRect();
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.space.setFocus((r.left + r.width / 2) / w, (r.top + r.height * 0.45) / h);
  }

  private loadingHtml(): string {
    return `<section class="screen center"><div class="loader" role="status"><div class="ring"></div><p>Tuning in…</p></div></section>`;
  }

  private errorHtml(): string {
    return `<section class="screen center"><div class="glass panel narrow"><h2>No signal</h2><p>The game data could not be loaded. Check your connection and try again.</p><button class="btn primary" data-act="reload">Try again</button></div></section>`;
  }

  private homeHtml(): string {
    const ds = this.ds!;
    const today = utcDate();
    const done = this.save.daily?.date === today;
    const solvedCount = Object.keys(this.save.archive).filter((id) => ds.row(id)).length;
    const greet = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const dailyNo = dailyNumber(today);
    const streak = this.save.dailyStreak.count && this.isRecentDaily() ? ` · 🔥 ${this.save.dailyStreak.count}-day streak` : "";
    return `<section class="screen home">
      <header class="brand">
        <div class="logo" aria-hidden="true"><span></span></div>
        <h1>NEXUS <em>RELAY</em></h1>
        <p class="tag">Catch the clues. Name the mystery.</p>
      </header>
      <div class="host">
        <div class="vex-slot big"></div>
        <p class="bubble">${esc(greet)}</p>
      </div>
      <nav class="menu" aria-label="Game modes">
        <button class="menu-card daily ${done ? "done" : ""}" data-act="daily">
          <span class="mi" aria-hidden="true">📡</span>
          <span class="mt">Daily Broadcast <b>#${dailyNo}</b></span>
          <span class="ms">${done ? `Played today · ${this.save.daily!.score.toLocaleString()} pts — see result` : `10 mysteries · the same for everyone today${streak}`}</span>
        </button>
        <button class="menu-card" data-act="quick"><span class="mi" aria-hidden="true">⚡</span><span class="mt">Quick Play</span><span class="ms">10 random mysteries</span></button>
        <button class="menu-card" data-act="channels"><span class="mi" aria-hidden="true">🛰️</span><span class="mt">Channels</span><span class="ms">Pick a category you love</span></button>
        <button class="menu-card" data-act="endless"><span class="mi" aria-hidden="true">♾️</span><span class="mt">Endless</span><span class="ms">3 lives · how far can you go?</span></button>
      </nav>
      <div class="menu-row">
        <button class="chip-btn" data-act="archive">🗂️ Signal Archive <b>${solvedCount}/${ds.index.count}</b></button>
        <button class="chip-btn" data-act="tutorial">❓ How to play</button>
        <button class="chip-btn" data-act="settings">⚙️ Settings</button>
      </div>
    </section>`;
  }

  private isRecentDaily(): boolean {
    const last = this.save.dailyStreak.last;
    if (!last) return false;
    const diff = (Date.parse(utcDate() + "T00:00:00Z") - Date.parse(last + "T00:00:00Z")) / 86400000;
    return diff <= 1;
  }

  private channelsHtml(): string {
    const ds = this.ds!;
    const tiles = ds.categories
      .map((c) => {
        const solved = ds.rows.filter((r) => r.c === c.id && this.save.archive[r.id]).length;
        const pct = Math.round((solved / Math.max(1, c.count)) * 100);
        return `<button class="tile" data-act="channel" data-cat="${c.id}">
          <span class="ti" aria-hidden="true">${c.icon}</span>
          <span class="tn">${esc(c.name)}</span>
          <span class="tp"><i style="width:${pct}%"></i></span>
          <span class="ts">${solved}/${c.count} archived</span>
        </button>`;
      })
      .join("");
    return `<section class="screen list">
      <header class="screen-head"><button class="icon-btn" data-act="home" aria-label="Back to home">←</button><h2>Channels</h2></header>
      <p class="lead">Pick a channel for 10 mysteries from one category.</p>
      <div class="tiles">${tiles}</div>
    </section>`;
  }

  private archiveHtml(): string {
    const ds = this.ds!;
    const st = this.save.stats;
    const solvedTotal = Object.keys(this.save.archive).filter((id) => ds.row(id)).length;
    const acc = st.rounds ? Math.round((st.solved / st.rounds) * 100) : 0;
    const cats = ds.categories
      .map((c) => {
        const rows = ds.rows.filter((r) => r.c === c.id);
        const got = rows.filter((r) => this.save.archive[r.id]);
        const pct = Math.round((got.length / Math.max(1, rows.length)) * 100);
        const names = got.length
          ? got.map((r) => `<li class="${this.save.archive[r.id].best === 1 ? "star" : ""}">${esc(r.n)}</li>`).join("")
          : `<li class="empty">Nothing archived yet — play this channel!</li>`;
        return `<details class="arch-cat glass">
          <summary><span class="ti" aria-hidden="true">${c.icon}</span><span class="tn">${esc(c.name)}</span><span class="tp"><i style="width:${pct}%"></i></span><span class="ts">${got.length}/${rows.length}</span></summary>
          <ul class="arch-list">${names}</ul>
        </details>`;
      })
      .join("");
    return `<section class="screen list">
      <header class="screen-head"><button class="icon-btn" data-act="home" aria-label="Back to home">←</button><h2>Signal Archive</h2></header>
      <div class="stat-grid">
        <div class="stat glass"><b>${solvedTotal}</b><span>of ${ds.index.count} decoded</span></div>
        <div class="stat glass"><b>${st.bestScore.toLocaleString()}</b><span>best run</span></div>
        <div class="stat glass"><b>${st.bestStreak}</b><span>best streak</span></div>
        <div class="stat glass"><b>${acc}%</b><span>rounds solved</span></div>
        <div class="stat glass"><b>${st.firstClue}</b><span>first-clue solves</span></div>
        <div class="stat glass"><b>${st.runs}</b><span>runs played</span></div>
      </div>
      <p class="lead">Every mystery you solve is stored here. ⭐ = solved on the very first clue.</p>
      <div class="arch">${cats}</div>
    </section>`;
  }

  private settingsHtml(): string {
    const s = this.save.settings;
    const sw = (id: string, label: string, on: boolean, hint: string) =>
      `<label class="switch glass"><span><b>${label}</b><small>${hint}</small></span><input type="checkbox" data-set="${id}" ${on ? "checked" : ""}><i aria-hidden="true"></i></label>`;
    const motion = s.reducedMotion == null ? "auto" : s.reducedMotion ? "on" : "off";
    return `<section class="screen list">
      <header class="screen-head"><button class="icon-btn" data-act="home" aria-label="Back to home">←</button><h2>Settings</h2></header>
      <div class="settings">
        ${sw("sound", "Sound effects", s.sound, "Little bleeps and bloops")}
        ${sw("music", "Music", s.music, "A calm background loop")}
        ${sw("turbo", "Turbo mode", s.turbo, `A gentle ${TURBO_SECONDS}-second timer per clue, double speed bonus`)}
        ${sw("contrast", "High contrast", s.contrast, "Stronger colours and outlines")}
        <label class="select glass"><span><b>Reduce motion</b><small>Calmer animations</small></span>
          <select data-set="motion"><option value="auto" ${motion === "auto" ? "selected" : ""}>Match my device</option><option value="on" ${motion === "on" ? "selected" : ""}>On</option><option value="off" ${motion === "off" ? "selected" : ""}>Off</option></select></label>
        <label class="select glass"><span><b>Graphics</b><small>Auto lowers quality on slow devices</small></span>
          <select data-set="quality"><option value="auto" ${s.quality === "auto" ? "selected" : ""}>Auto</option><option value="high" ${s.quality === "high" ? "selected" : ""}>High</option><option value="low" ${s.quality === "low" ? "selected" : ""}>Battery saver</option></select></label>
        <button class="btn ghost danger" data-act="reset">Reset all progress</button>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------ runs
  private dailyPlan(): IndexRow[] {
    const ds = this.ds!;
    const date = utcDate();
    return planRun(ds.rows, ds.categories.map((c) => c.id), dailyRng(date));
  }

  async startRun(mode: Mode, category?: string): Promise<void> {
    const ds = this.ds;
    if (!ds || this.busy) return;
    if (mode === "daily" && this.save.daily?.date === utcDate()) {
      this.lastShare = this.save.daily.share;
      this.render("daily-done");
      return;
    }
    this.busy = true;
    const notSolved = (r: IndexRow) => !this.save.archive[r.id];
    let plan: IndexRow[] = [];
    let rng = seededRng();
    if (mode === "daily") {
      rng = dailyRng(utcDate() + ":options");
      plan = this.dailyPlan();
    } else if (mode === "quick") {
      plan = planRun(ds.rows, ds.categories.map((c) => c.id), rng, { prefer: notSolved });
    } else if (mode === "channel" && category) {
      this.channel = category;
      plan = planRun(ds.rows, [category], rng, { category, prefer: notSolved });
    }
    this.run = new Run({
      mode,
      index: ds.rows,
      rng,
      turbo: this.save.settings.turbo && mode !== "tutorial",
      plan,
      rounds: mode === "endless" ? undefined : plan.length || ROUNDS_PER_RUN,
    });
    this.render("loading");
    try {
      if (plan.length) await ds.preload(plan.map((r) => r.id));
      await this.nextRound();
    } catch {
      this.render("error");
    } finally {
      this.busy = false;
    }
  }

  private async nextRound(): Promise<void> {
    const run = this.run;
    const ds = this.ds;
    if (!run || !ds) return;
    if (run.over) {
      this.finishRun();
      return;
    }
    let row: IndexRow | null;
    if (run.mode === "endless") {
      row = endlessNext(ds.rows, run.roundNo, run.seen, run.rng, (r) => !this.save.archive[r.id]);
    } else {
      row = run.plannedNext();
    }
    if (!row) {
      this.finishRun();
      return;
    }
    const subject = await ds.subject(row.id);
    let fixed: string[] | undefined;
    if (run.mode === "tutorial") fixed = this.tutorialOptions(row);
    // Daily: options are seeded per subject so every player sees the
    // same four cards, whatever they did in earlier rounds.
    if (run.mode === "daily") fixed = buildOptions(row, ds.rows, dailyRng(`${utcDate()}:${row.id}`));
    run.startRound(subject, performance.now(), fixed);
    if (this.screen !== "game") this.render("game");
    else this.renderRound();
    this.sfx.clue(1);
    this.space?.pulse("cyan");
    this.vex?.set("think", 1200);
  }

  private tutorialOptions(row: IndexRow): string[] {
    const ds = this.ds!;
    const picks = ["hamburger", "sushi", "tacos", "croissant", "pasta", "ramen", "hot-dog"]
      .filter((id) => ds.row(id) && id !== row.id)
      .slice(0, 3);
    const rest = ds.rows.filter((r) => r.c === row.c && r.id !== row.id && !picks.includes(r.id));
    while (picks.length < 3 && rest.length) picks.push(rest.shift()!.id);
    return [picks[0], row.id, picks[1], picks[2]];
  }

  // ------------------------------------------------------- game view
  private gameHtml(): string {
    const run = this.run!;
    return `<section class="screen game ${run.turbo ? "turbo" : ""}">
      <header class="hud">
        <button class="icon-btn" data-act="quit" aria-label="Leave this run">✕</button>
        <div class="hud-mode"><span class="mode-name">${esc(run.mode === "channel" && this.channel ? this.ds!.category(this.channel)?.name ?? "Channel" : MODE_LABEL[run.mode])}</span><span class="round-no" id="round-no"></span></div>
        <div class="hud-right">
          <div class="lives" id="lives" ${run.mode === "endless" ? "" : "hidden"}></div>
          <div class="streak-chip" id="streak" aria-live="off"></div>
          <div class="score"><span id="score-val">0</span><small>pts</small></div>
        </div>
      </header>
      <div class="stage">
        <section class="transmission glass" aria-label="Clues">
          <div class="tx-head">
            <div class="vex-slot"></div>
            <div class="tx-info"><div class="tx-label">Incoming transmission</div><div class="tx-cat" id="tx-cat"></div></div>
            <div class="worth" id="worth" aria-live="off"></div>
          </div>
          <div class="meter" id="meter" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<i data-n="${n}"></i>`).join("")}</div>
          <div class="timer" id="timer" hidden><i></i></div>
          <ol class="clues" id="clues" aria-live="polite" aria-relevant="additions"></ol>
        </section>
        <div class="play" id="play">
          <section class="answers" id="answers" aria-label="Answers"></section>
          <div class="actions" id="actions">
            <button class="btn ghost" data-act="next-clue" id="next-clue"></button>
            <button class="btn ghost jam" data-act="jammer" id="jammer"></button>
          </div>
        </div>
        <section class="result glass" id="result" hidden></section>
      </div>
    </section>`;
  }

  private renderRound(): void {
    const run = this.run;
    const ds = this.ds;
    const r = run?.round;
    if (!run || !ds || !r) return;
    const cat = ds.category(r.subject.category);
    $("#round-no")!.textContent =
      run.mode === "endless" ? `Round ${run.roundNo}` : run.mode === "tutorial" ? "Practice" : `Round ${run.roundNo} / ${run.totalRounds}`;
    $("#tx-cat")!.innerHTML = `<span aria-hidden="true">${cat?.icon ?? ""}</span> ${esc(cat?.name ?? "")} · <b>${esc(r.subject.sub)}</b>`;
    $("#result")!.hidden = true;
    $("#play")!.hidden = false;
    const answers = $("#answers")!;
    answers.innerHTML = r.options
      .map(
        (id, i) =>
          `<button class="card" data-act="pick" data-id="${id}" style="--i:${i}"><span class="key" aria-hidden="true">${i + 1}</span><span class="nm">${esc(ds.name(id))}</span><span class="st" aria-hidden="true"></span></button>`
      )
      .join("");
    const clues = $("#clues")!;
    clues.innerHTML = "";
    this.renderClues(true);
    this.updateHud();
    this.startTurbo();
    if (this.tutorialStep >= 0) this.showCoach();
    window.setTimeout(() => this.updateFocus(), 50);
  }

  /** Add any newly revealed clues (newest on top) and refresh state. */
  private renderClues(fresh = false): void {
    const r = this.run?.round;
    if (!r) return;
    const list = $("#clues")!;
    const have = list.children.length;
    for (let n = have + 1; n <= r.clue; n++) {
      const li = document.createElement("li");
      li.className = "clue";
      li.innerHTML = `<span class="cn">Clue ${n}</span><span class="ct">${esc(r.subject.clues[n - 1])}</span>`;
      list.prepend(li);
    }
    [...list.children].forEach((el, i) => el.classList.toggle("latest", i === 0));
    if (!fresh && r.clue > have) this.announce(`Clue ${r.clue}: ${r.subject.clues[r.clue - 1]}`);
    if (fresh) this.announce(`New mystery. ${r.subject.sub}. Clue 1: ${r.subject.clues[0]}`);
    this.updateCards();
    this.updateHud();
  }

  private updateCards(): void {
    const run = this.run;
    const r = run?.round;
    if (!run || !r) return;
    document.querySelectorAll<HTMLButtonElement>("#answers .card").forEach((btn, i) => {
      const id = btn.dataset.id!;
      const name = this.ds!.name(id);
      const wrong = r.wrong.has(id);
      const jammed = r.jammed.has(id);
      const isAnswer = id === r.subject.id;
      btn.classList.toggle("wrong", wrong);
      btn.classList.toggle("jammed", jammed);
      btn.classList.toggle("right", isAnswer && r.phase !== "guessing");
      btn.classList.toggle("reveal", isAnswer && r.phase === "missed");
      btn.disabled = wrong || jammed || r.phase !== "guessing";
      const st = btn.querySelector(".st")!;
      st.textContent = wrong ? "✕" : jammed ? "⚡" : isAnswer && r.phase !== "guessing" ? "✓" : "";
      btn.setAttribute(
        "aria-label",
        `${i + 1}: ${name}${wrong ? " — not it" : jammed ? " — removed by Jammer" : isAnswer && r.phase !== "guessing" ? " — the answer" : ""}`
      );
    });
  }

  private updateHud(): void {
    const run = this.run;
    const r = run?.round;
    if (!run || !r) return;
    $("#score-val")!.textContent = run.score.toLocaleString();
    const mult = streakMultiplier(run.streak + 1);
    const streak = $("#streak")!;
    streak.textContent = run.streak ? `🔥 ${run.streak} · ×${mult}` : `×${mult}`;
    const tier = nextTier(run.streak + 1);
    streak.title = tier ? `${tier.at - run.streak - 1} more in a row for ×${tier.mult}` : "Max combo!";
    streak.dataset.hot = String(mult > 1);
    const lives = $("#lives");
    if (lives && run.mode === "endless") {
      lives.innerHTML = [0, 1, 2].map((i) => `<span class="${i < run.lives ? "on" : "off"}">♥</span>`).join("");
      lives.setAttribute("aria-label", `${run.lives} lives left`);
    }
    const worth = $("#worth")!;
    worth.innerHTML = r.phase === "guessing" ? `<b>${cluePoints(r.clue)}</b><small>pts now</small>` : "";
    document.querySelectorAll<HTMLElement>("#meter i").forEach((el) => {
      const n = Number(el.dataset.n);
      el.className = n < r.clue ? "on" : n === r.clue ? "on now" : "";
    });
    const next = $<HTMLButtonElement>("#next-clue")!;
    next.disabled = r.phase !== "guessing" || r.clue >= 5;
    next.innerHTML = r.clue >= 5 ? "Last clue" : `Next clue <small>(${cluePoints(r.clue + 1)} pts)</small> <kbd>N</kbd>`;
    const jam = $<HTMLButtonElement>("#jammer")!;
    jam.disabled = run.jammerLeft <= 0 || r.phase !== "guessing" || run.liveOptions().length < 3;
    jam.innerHTML = `⚡ Jammer 50/50 <small>${run.jammerLeft ? "1 left" : "used"}</small> <kbd>J</kbd>`;
  }

  // ----------------------------------------------------------- turbo
  private startTurbo(): void {
    this.stopTurbo();
    const run = this.run;
    const timer = $("#timer");
    if (!run?.turbo || !timer) return;
    timer.hidden = false;
    const bar = timer.querySelector("i") as HTMLElement;
    let lastClue = -1;
    let started = performance.now();
    let lastTick = 0;
    this.turboTimer = window.setInterval(() => {
      const r = this.run?.round;
      if (!r || r.phase !== "guessing") {
        this.stopTurbo();
        return;
      }
      if (r.clue !== lastClue) {
        lastClue = r.clue;
        started = performance.now();
      }
      const left = TURBO_SECONDS * 1000 - (performance.now() - started);
      bar.style.transform = `scaleX(${Math.max(0, left / (TURBO_SECONDS * 1000))})`;
      timer.classList.toggle("low", left < 5000);
      if (left < 3500 && Math.floor(left / 1000) !== lastTick) {
        lastTick = Math.floor(left / 1000);
        this.sfx.tick();
      }
      if (left <= 0) {
        const res = this.run!.timeout(performance.now());
        if (res === "next") this.onNewClue();
        else if (res === "missed") this.onMissed();
      }
    }, 100);
  }

  private stopTurbo(): void {
    if (this.turboTimer !== null) window.clearInterval(this.turboTimer);
    this.turboTimer = null;
  }

  private clearTimers(): void {
    this.stopTurbo();
    if (this.resultTimer !== null) window.clearTimeout(this.resultTimer);
    this.resultTimer = null;
  }

  // --------------------------------------------------------- actions
  pickIndex(i: number): void {
    const r = this.run?.round;
    if (!r) return;
    if (r.phase === "guessing") {
      const id = r.options[i];
      if (id) this.pick(id);
    } else if (r.phase === "solved" && r.link && r.linkAnswer == null && $("#result")?.hidden === false) {
      // (only once the bonus panel is on screen — not during the
      // celebration delay, which would answer an unseen question)
      const opt = r.link.options[i];
      if (opt != null) this.answerLink(opt);
    }
  }

  pick(id: string): void {
    const run = this.run;
    if (!run?.round) return;
    const res = run.pick(id, performance.now());
    if (res === "ignored") return;
    const btn = [...document.querySelectorAll<HTMLElement>("#answers .card")].find((b) => b.dataset.id === id) ?? null;
    if (res === "correct") {
      this.sfx.correct();
      this.space?.pulse("green");
      this.vex?.set("happy");
      this.updateCards();
      this.updateHud();
      if (btn) {
        const rect = btn.getBoundingClientRect();
        this.confetti?.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, run.round.clue <= 2 ? 1.2 : 0.8);
        btn.classList.add("pop");
      }
      this.announce(`Correct! ${run.round.subject.name}. Plus ${run.round.score!.total} points.`);
      this.resultTimer = window.setTimeout(() => this.showResult(), this.reducedMotion() ? 150 : 750);
    } else if (res === "wrong") {
      this.sfx.wrong();
      this.space?.pulse("magenta");
      this.vex?.set("sad", 900);
      btn?.classList.add("shake");
      this.announce(`Not ${this.ds!.name(id)}.`);
      this.onNewClue(true);
    } else if (res === "missed") {
      this.sfx.wrong();
      this.onMissed();
    }
  }

  private onNewClue(silentSfx = false): void {
    const r = this.run?.round;
    if (!r) return;
    if (!silentSfx) this.sfx.clue(r.clue);
    this.space?.pulse(silentSfx ? "magenta" : "cyan");
    if (!silentSfx) this.vex?.set("think", 900);
    this.renderClues();
    if (this.tutorialStep >= 0) this.showCoach();
  }

  private onMissed(): void {
    const run = this.run!;
    this.space?.pulse("amber");
    this.vex?.set("sad");
    this.updateCards();
    this.updateHud();
    this.announce(`Out of clues. It was ${run.round!.subject.name}.`);
    this.resultTimer = window.setTimeout(() => this.showResult(), this.reducedMotion() ? 150 : 900);
  }

  nextClue(): void {
    if (this.run?.nextClue(performance.now())) this.onNewClue();
  }

  jammer(): void {
    const removed = this.run?.useJammer() ?? [];
    if (!removed.length) return;
    this.sfx.zap();
    this.space?.pulse("amber");
    this.vex?.set("wink", 1000);
    this.updateCards();
    this.updateHud();
    this.announce(`Jammer used. Two wrong answers removed.`);
  }

  private showResult(): void {
    const run = this.run;
    const r = run?.round;
    if (!run || !r) return;
    const res = $("#result")!;
    const play = $("#play")!;
    const s = r.subject;
    let body = "";
    if (r.phase === "solved" && r.score) {
      const sc = r.score;
      body += `<div class="res-head ok"><span class="badge" aria-hidden="true">✓</span><div><div class="res-k">Solved on clue ${r.clue}</div><h3>${esc(s.name)}</h3></div></div>
        <div class="calc"><span>${sc.base}</span>${sc.speed ? `<span>+${sc.speed} speed</span>` : ""}${sc.multiplier > 1 ? `<span>×${sc.multiplier} streak</span>` : ""}<b>= +${sc.total}</b></div>`;
      if (r.link) {
        body += `<div class="link-q"><div class="lq-title">🔗 Bonus link: which of these is connected to <b>${esc(s.name)}</b>?</div>
          <div class="lq-opts">${r.link.options.map((o, i) => `<button class="btn link-opt" data-act="link" data-opt="${esc(o)}"><kbd>${i + 1}</kbd> ${esc(o)}</button>`).join("")}</div>
          <div class="lq-out" id="lq-out" aria-live="polite"></div></div>`;
      }
    } else {
      body += `<div class="res-head miss"><span class="badge" aria-hidden="true">?</span><div><div class="res-k">The mystery was</div><h3>${esc(s.name)}</h3></div></div>`;
      if (run.mode === "endless") body += `<p class="res-note">${run.lives > 0 ? `${run.lives} ${run.lives === 1 ? "life" : "lives"} left — keep going!` : "That was your last life."}</p>`;
      else body += `<p class="res-note">No worries — your streak resets, but the run goes on.</p>`;
    }
    // The fun fact can mention the linked thing, so it stays hidden
    // until the bonus link has been answered.
    const pendingLink = r.phase === "solved" && !!r.link;
    if (s.fact) body += `<p class="fact" id="fact" ${pendingLink ? "hidden" : ""}><span aria-hidden="true">💡</span> ${esc(s.fact)}</p>`;
    const last = run.over;
    body += `<button class="btn primary next" data-act="continue" id="continue" ${r.phase === "solved" && r.link ? "hidden" : ""}>${last ? "See results" : "Next mystery"} <kbd>Enter</kbd></button>`;
    res.innerHTML = body;
    play.hidden = true;
    res.hidden = false;
    this.updateHud();
    const focusEl = $<HTMLElement>(".link-opt", res) ?? $<HTMLElement>("#continue", res);
    focusEl?.focus({ preventScroll: true });
    if (this.tutorialStep >= 0) this.tutorialAdvanceOn("solve");
  }

  answerLink(opt: string): void {
    const run = this.run;
    const r = run?.round;
    if (!run || !r?.link || r.linkAnswer != null) return;
    const ok = run.answerLink(opt);
    const link = r.link;
    document.querySelectorAll<HTMLButtonElement>(".link-opt").forEach((b) => {
      b.disabled = true;
      if (b.dataset.opt === link.correct) b.classList.add("right");
      else if (b.dataset.opt === opt) b.classList.add("wrong");
    });
    const out = $("#lq-out")!;
    out.innerHTML = ok
      ? `<b class="okc">Yes! +100</b> ${esc(r.subject.name)} ${esc(link.rel)} ${esc(link.correct)}.`
      : `<b class="noc">Close!</b> ${esc(r.subject.name)} ${esc(link.rel)} ${esc(link.correct)}.`;
    if (ok) {
      this.sfx.zap();
      this.space?.pulse("magenta");
      const b = $<HTMLElement>(`.link-opt.right`);
      if (b) {
        const rect = b.getBoundingClientRect();
        this.confetti?.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.5);
      }
    }
    this.updateHud();
    const fact = $("#fact");
    if (fact) fact.hidden = false;
    const cont = $<HTMLButtonElement>("#continue")!;
    cont.hidden = false;
    cont.focus({ preventScroll: true });
    if (this.tutorialStep >= 0) this.tutorialAdvanceOn("link");
  }

  async continue(): Promise<void> {
    const r = this.run?.round;
    if (!r || r.phase === "guessing" || this.busy) return;
    if (r.phase === "solved" && r.link && r.linkAnswer == null) return;
    if (this.run!.mode === "tutorial") {
      this.tutorialStep = TUTORIAL.length - 1;
      this.showCoach();
      return;
    }
    this.busy = true;
    try {
      await this.nextRound();
    } finally {
      this.busy = false;
    }
  }

  // --------------------------------------------------------- summary
  private finishRun(): void {
    const run = this.run;
    if (!run) return;
    if (run.mode === "tutorial") {
      this.endTutorial();
      return;
    }
    const st = this.save.stats;
    st.runs += 1;
    st.rounds += run.records.length;
    st.solved += run.records.filter((r) => r.solved).length;
    st.firstClue += run.records.filter((r) => r.solved && r.clue === 1).length;
    st.links += run.records.filter((r) => r.link).length;
    st.bestScore = Math.max(st.bestScore, run.score);
    st.bestStreak = Math.max(st.bestStreak, run.bestStreak);
    st.totalScore += run.score;
    if (run.mode === "endless") st.bestEndless = Math.max(st.bestEndless, run.score);
    this.newlyArchived = 0;
    const now = new Date().toISOString();
    for (const rec of run.records) {
      if (!rec.solved) continue;
      const cur = this.save.archive[rec.id];
      if (!cur) {
        this.save.archive[rec.id] = { at: now, best: rec.clue };
        this.newlyArchived++;
      } else cur.best = Math.min(cur.best, rec.clue);
    }
    const today = utcDate();
    this.lastShare = shareText({
      mode: run.mode,
      dailyNo: dailyNumber(today),
      score: run.score,
      rounds: run.records,
      bestStreak: run.bestStreak,
    });
    if (run.mode === "daily") {
      const yesterday = utcDate(new Date(Date.now() - 86400000));
      const ds = this.save.dailyStreak;
      ds.count = ds.last === yesterday ? ds.count + 1 : ds.last === today ? ds.count : 1;
      ds.last = today;
      this.save.daily = {
        date: today,
        number: dailyNumber(today),
        score: run.score,
        share: this.lastShare,
        solved: run.records.filter((r) => r.solved).length,
      };
    }
    this.persist();
    this.sfx.fanfare();
    this.render("summary");
    const rect = $(".big-score")?.getBoundingClientRect();
    if (rect) this.confetti?.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.4);
  }

  private summaryHtml(): string {
    const run = this.run!;
    const solved = run.records.filter((r) => r.solved).length;
    const title =
      run.mode === "endless" ? `You reached round ${run.records.length}!` : solved >= 8 ? "Outstanding decoding!" : solved >= 5 ? "Transmission complete!" : "Good run!";
    const rows = run.records
      .map(
        (r) =>
          `<li class="${r.solved ? "ok" : "miss"}"><span class="sq" aria-hidden="true">${r.solved ? ["🟩", "🟦", "🟨", "🟧", "🟥"][r.clue - 1] : "⬛"}</span><span class="nm">${esc(r.name)}</span><span class="pt">${r.solved ? `clue ${r.clue} · +${r.points}` : "missed"}${r.link ? " · 🔗" : ""}</span></li>`
      )
      .join("");
    const isDaily = run.mode === "daily";
    return `<section class="screen summary">
      <div class="host"><div class="vex-slot big"></div></div>
      <h2>${esc(title)}</h2>
      <div class="big-score" aria-live="polite"><span id="final-score" data-to="${run.score}">${run.score.toLocaleString()}</span><small>points</small></div>
      <div class="sum-stats">
        <span>✅ ${solved}/${run.records.length} solved</span><span>🔥 best streak ${run.bestStreak}</span><span>🗂️ ${this.newlyArchived} new in archive</span>
      </div>
      <ol class="sum-list glass">${rows}</ol>
      <div class="sum-actions">
        ${isDaily || run.mode === "endless" ? `<button class="btn primary" data-act="share">Share result</button>` : ""}
        <button class="btn ${isDaily ? "ghost" : "primary"}" data-act="again">${isDaily ? "Quick Play" : "Play again"}</button>
        <button class="btn ghost" data-act="home">Home</button>
      </div>
      ${isDaily ? `<p class="lead small">A new Daily Broadcast arrives in ${this.untilTomorrow()}.</p>` : ""}
    </section>`;
  }

  private dailyDoneHtml(): string {
    const d = this.save.daily!;
    return `<section class="screen summary">
      <div class="host"><div class="vex-slot big"></div></div>
      <h2>Daily Broadcast #${d.number} — done!</h2>
      <div class="big-score"><span>${d.score.toLocaleString()}</span><small>points · ${d.solved}/10 solved</small></div>
      <pre class="share-box glass">${esc(d.share)}</pre>
      <div class="sum-actions">
        <button class="btn primary" data-act="share">Share result</button>
        <button class="btn ghost" data-act="quick">Quick Play</button>
        <button class="btn ghost" data-act="home">Home</button>
      </div>
      <p class="lead small">The next broadcast arrives in ${this.untilTomorrow()}.</p>
    </section>`;
  }

  private untilTomorrow(): string {
    const now = Date.now();
    const next = Date.parse(utcDate() + "T00:00:00Z") + 86400000;
    const mins = Math.max(1, Math.round((next - now) / 60000));
    const h = Math.floor(mins / 60);
    return h ? `${h}h ${mins % 60}m` : `${mins}m`;
  }

  private animateSummary(): void {
    this.vex?.set("happy");
    const el = $("#final-score");
    if (!el || this.reducedMotion()) return;
    const to = Number(el.dataset.to);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1100);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4))).toLocaleString();
      if (k < 1 && this.screen === "summary") requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private async share(): Promise<void> {
    const text = this.lastShare || this.save.daily?.share || SHARE_URL;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* cancelled — fall back to copy */
    }
    try {
      await navigator.clipboard.writeText(text);
      this.toast("Result copied — paste it anywhere!");
    } catch {
      this.toast("Copy not available — select the text to share.");
    }
  }

  toast(msg: string): void {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    window.setTimeout(() => t.classList.remove("show"), 2200);
  }

  // -------------------------------------------------------- tutorial
  async startTutorial(): Promise<void> {
    const ds = this.ds;
    if (!ds) return;
    const row = ds.row(TUTORIAL_ID) ?? ds.rows.find((r) => r.c === "food" && r.d === 1) ?? ds.rows[0];
    this.tutorialStep = 0;
    this.run = new Run({ mode: "tutorial", index: ds.rows, rng: seededRng(7), plan: [row], rounds: 1 });
    this.render("loading");
    try {
      await ds.preload([row.id]);
      await this.nextRound();
    } catch {
      this.render("error");
    }
  }

  private showCoach(): void {
    const step = TUTORIAL[this.tutorialStep];
    if (!step) return;
    document.querySelectorAll(".coach-target").forEach((el) => el.classList.remove("coach-target"));
    if (!this.coach) {
      this.coach = document.createElement("div");
      this.coach.className = "coach glass";
      this.coach.setAttribute("role", "dialog");
      this.coach.setAttribute("aria-label", "How to play");
      document.body.append(this.coach);
    }
    this.coach.innerHTML = `<div class="coach-top"><span class="coach-n">${this.tutorialStep + 1}/${TUTORIAL.length}</span><button class="link-btn" data-coach="skip">Skip tutorial</button></div>
      <p>${esc(step.text)}</p>
      ${step.button ? `<button class="btn primary" data-coach="next">${esc(step.button)}</button>` : ""}`;
    this.coach.querySelector('[data-coach="skip"]')!.addEventListener("click", () => this.endTutorial());
    this.coach.querySelector('[data-coach="next"]')?.addEventListener("click", () => {
      if (this.tutorialStep >= TUTORIAL.length - 1) this.endTutorial();
      else {
        this.tutorialStep++;
        this.showCoach();
      }
    });
    if (step.target) $(step.target)?.classList.add("coach-target");
    this.coach.dataset.pos = step.target === ".transmission" ? "bottom" : "top";
  }

  private tutorialAdvanceOn(wait: "solve" | "link"): void {
    const step = TUTORIAL[this.tutorialStep];
    if (!step) return;
    // Solving early (before step 4) jumps straight to the bonus step.
    if (wait === "solve" && this.tutorialStep <= 3) {
      this.tutorialStep = this.run?.round?.link ? 4 : 5;
      this.showCoach();
    } else if (wait === "link" && step.wait === "link") {
      this.tutorialStep = 5;
      this.showCoach();
    }
  }

  endTutorial(): void {
    this.tutorialStep = -1;
    this.coach?.remove();
    this.coach = null;
    document.querySelectorAll(".coach-target").forEach((el) => el.classList.remove("coach-target"));
    this.save.tutorialDone = true;
    this.persist();
    this.run = null;
    this.render("home");
  }

  // ----------------------------------------------------------- input
  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!el || (el as HTMLButtonElement).disabled) return;
    const act = el.dataset.act!;
    if (act !== "pick" && act !== "link") this.sfx.click();
    switch (act) {
      case "daily":
        void this.startRun("daily");
        break;
      case "quick":
        void this.startRun("quick");
        break;
      case "endless":
        void this.startRun("endless");
        break;
      case "channels":
        this.render("channels");
        break;
      case "channel":
        void this.startRun("channel", el.dataset.cat);
        break;
      case "archive":
        this.render("archive");
        break;
      case "settings":
        this.render("settings");
        break;
      case "tutorial":
        void this.startTutorial();
        break;
      case "home":
        this.run = null;
        this.render("home");
        break;
      case "quit":
        this.quit();
        break;
      case "pick":
        this.pick(el.dataset.id!);
        break;
      case "next-clue":
        this.nextClue();
        break;
      case "jammer":
        this.jammer();
        break;
      case "link":
        this.answerLink(el.dataset.opt!);
        break;
      case "continue":
        void this.continue();
        break;
      case "again":
        if (this.run?.mode === "channel" && this.channel) void this.startRun("channel", this.channel);
        else void this.startRun(this.run?.mode === "endless" ? "endless" : "quick");
        break;
      case "share":
        void this.share();
        break;
      case "reset":
        if (window.confirm("Reset all progress, stats and the Signal Archive? This cannot be undone.")) {
          clearSave();
          const keepSettings = this.save.settings;
          this.save = defaultSave();
          this.save.settings = keepSettings;
          this.save.tutorialDone = true;
          this.persist();
          this.toast("Progress reset.");
          this.render("settings");
        }
        break;
      case "reload":
        window.location.reload();
        break;
    }
  }

  private quit(): void {
    if (this.run?.mode === "tutorial") {
      this.endTutorial();
      return;
    }
    const mid = this.run && this.run.records.length > 0 && !this.run.over;
    if (mid && !window.confirm("Leave this run? Your progress in it will be lost.")) return;
    this.run = null;
    this.render("home");
  }

  private onChange(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    const key = el.dataset.set;
    if (!key) return;
    const s = this.save.settings;
    if (key === "motion") s.reducedMotion = el.value === "auto" ? null : el.value === "on";
    else if (key === "quality") s.quality = el.value as "auto" | "high" | "low";
    else if (key === "sound" || key === "music" || key === "turbo" || key === "contrast") s[key] = (el as HTMLInputElement).checked;
    this.persist();
    this.applySettings();
    if (key === "sound" && s.sound) this.sfx.click();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (this.screen === "game") {
      const r = this.run?.round;
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        this.pickIndex(Number(e.key) - 1);
      } else if ((e.key === "n" || e.key === "N") && r?.phase === "guessing") {
        this.nextClue();
      } else if ((e.key === "j" || e.key === "J") && r?.phase === "guessing") {
        this.jammer();
      } else if (e.key === "Enter" && r && r.phase !== "guessing") {
        const cont = $<HTMLButtonElement>("#continue");
        if (cont && !cont.hidden && document.activeElement !== cont) {
          e.preventDefault();
          void this.continue();
        }
      } else if (e.key === "Escape") {
        this.quit();
      }
    } else if (e.key === "Escape" && this.screen !== "home" && this.screen !== "loading") {
      this.run = null;
      this.render("home");
    }
  }

  /** Mood helper for tests / external callers. */
  mood(m: Mood): void {
    this.vex?.set(m);
  }
}
