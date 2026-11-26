/**
 * NEXUS RELAY — first-run FIELD TRAINING (guided practice round).
 *
 * A coach card in the console's own glass style walks a new
 * player through one scripted practice round played on the REAL
 * controls and the REAL engine (no mock state), teaching the CASUAL
 * loop (owner rebuild, Nov 26, 2026): the guest's TYPE is always
 * shown, you guess by name, and every guess answers in plain
 * language — 🔥 warmer / ❄️ colder, ⬆️ newer / ⬇️ older,
 * ✅ same field / ❌ different field. Every number quoted in the
 * coach copy is the implemented formula (ScoringSystem.ts):
 *   - 10 guesses per round (owner-directed casual economy).
 *   - The starting clue and every 💡 HINT are FREE — they spend no
 *     guess and never touch the score multiplier.
 *   - Base = 1000 x (guesses left / 10). Closeness bonus up to 250
 *     for warm misses. Overclock = 15 s; each valid chain-bridge
 *     adds x0.5, max x2.5. (The deep relay deck in DETAILS can still
 *     tune clues the old way — 1 guess and -9% multiplier each —
 *     which is why the multiplier exists at all.)
 *
 * Shows automatically on first visit only; the seen flag persists in
 * localStorage under the same key pattern as the Relic Vault
 * ("nexus-relay:<name>"). Skippable at any step; re-openable anytime
 * via the FIELD TRAINING button (Game.startTutorial).
 */

export const TUTORIAL_SEEN_KEY = "nexus-relay:tutorial-seen";

export interface TutorialState {
  started: boolean;
  finished: boolean;
  solved: boolean;
  probes: number;
  pings: number;
  tuned: number;
  hintsUsed: number;
  detailsOpen: boolean;
  bridges: number;
  phase: number;
}

export interface TutorialHost {
  state(): TutorialState;
  /** Called once when the tutorial closes (skip, finish, or abort). */
  onExit(): void;
}

export interface PracticeInfo {
  targetName: string;
  neighbourName: string;
}

interface Step {
  id: string;
  title: string;
  body: (info: PracticeInfo) => string;
  highlight: string | null;
  /** "next" = NEXT button; otherwise a predicate on live game state. */
  advance: "next" | ((s: TutorialState) => boolean);
  nextLabel?: string;
}

const STEPS: Step[] = [
  {
    id: "guest",
    title: "MEET THE MYSTERY GUEST",
    highlight: "#mystery-banner",
    advance: "next",
    body: () =>
      "Someone — or something — real is hiding in the core: a person, a place, a film, a creature. Here's the friendly part: you ALWAYS know what KIND of guest it is. The big banner tells you the type — a boxer, a city, a video game. Your only job is to guess the NAME. This is a practice round on a training signal, played with the real game. Nothing here touches your vault.",
  },
  {
    id: "guesses",
    title: "TEN GUESSES — PLENTY",
    highlight: ".probes-row",
    advance: "next",
    body: () =>
      "You get 10 guesses, and every single one teaches you something — there are no wasted guesses here. Run out without naming the guest and the round ends (gently — I'll show you how close you came). Guesses left over are worth score, so the warmer you play, the better you do.",
  },
  {
    id: "clue",
    title: "A FREE CLUE TO START",
    highlight: "#clue-box",
    advance: "next",
    body: () =>
      "Every round opens with a free starting clue, already waiting in the clue box. Free means free: it costs no guesses and no score — now or ever. Read it before your first guess; it's the era clue, and it quietly cuts the haystack down to a decade or two.",
  },
  {
    id: "guess",
    title: "MAKE A GUESS",
    highlight: ".hypothesis-box",
    advance: (s) => s.pings >= 1,
    body: (info) =>
      `Guessing is just typing a name. Anything real counts — people, places, events, inventions. ▸ For practice, guess "${info.neighbourName}" — a close friend of the guest — and watch how the game answers you.`,
  },
  {
    id: "warmer",
    title: "FEEDBACK 1 · WARMER OR COLDER",
    highlight: "#guess-feed",
    advance: "next",
    body: () =>
      "Every guess gets a report card. First line: 🔥 WARMER or ❄️ COLDER — is this guess closer to the guest than your last one? (Your first guess gets a starting read instead: hot, warm or cold.) Follow the heat and you will walk straight to the answer.",
  },
  {
    id: "newer",
    title: "FEEDBACK 2 · NEWER OR OLDER",
    highlight: "#guess-feed",
    advance: "next",
    body: () =>
      "Second line: ⬆️ NEWER or ⬇️ OLDER — where the GUEST sits in time compared with your guess. Guessed something from 1970 and it says ⬇️ OLDER? The guest is older than that — step back in time. 📅 SAME ERA means you've landed on exactly the right year.",
  },
  {
    id: "field",
    title: "FEEDBACK 3 · SAME FIELD?",
    highlight: "#guess-feed",
    advance: "next",
    body: () =>
      "Third line: ✅ SAME FIELD means your guess lives in the guest's corner of knowledge — a boxer for a boxer, a river for a river. 🧭 NEIGHBOURING FIELD is a close cousin. ❌ DIFFERENT FIELD means pivot — try a whole other corner of the world. Three little lines, and the guest has nowhere to hide.",
  },
  {
    id: "hint",
    title: "STUCK? FREE HINTS 💡",
    highlight: "#clue-box",
    advance: (s) => s.hintsUsed >= 1,
    body: () =>
      "The 💡 HINT button reveals another clue about the guest — and it NEVER punishes you. No guess spent, no score lost, no catch. There are four hints after your free starting clue, and using all five is a perfectly good way to play. ▸ Tap 💡 HINT now and see.",
  },
  {
    id: "details",
    title: "FOR THE CURIOUS · DETAILS 🔍",
    highlight: "#details-panel",
    advance: (s) => s.detailsOpen,
    body: () =>
      "Under the friendly surface there's a full instrument panel: five-axis telemetry for every guess (era, distance, graph hops, fame) and the original relay deck. It's all behind the 🔍 DETAILS tap — interesting, never required. ▸ Open DETAILS once to see it, then close it whenever you like.",
  },
  {
    id: "lock",
    title: "NOW NAME THE GUEST",
    highlight: ".hypothesis-box",
    advance: (s) => s.solved || s.finished,
    body: (info) =>
      `In a real round you'd now follow the heat — warmer, older, same field — until one name fits everything. ▸ For practice, today's guest is "${info.targetName}". Guess it exactly and watch what a win triggers.`,
  },
  {
    id: "overclock",
    title: "BONUS ROUND · OVERCLOCK ⚡",
    highlight: "#overclock-box",
    advance: (s) => s.bridges >= 1 || s.finished,
    body: () =>
      "A win ignites the 15-second Overclock bonus round. The lit-up beams are the guest's connections, labelled by relationship. Type anything connected to the guest — or connected to something you've already linked — before the timer drains. Each valid link adds ×0.5 to your score, up to ×2.5. ▸ Link one now, if the surge is still live.",
  },
  {
    id: "score",
    title: "HOW SCORING WORKS",
    highlight: null,
    advance: "next",
    nextLabel: "START PLAYING ▸",
    body: () =>
      "Your score, in plain words: BASE = 1,000 × (guesses left ÷ 10) — solve fast, score big. Warm misses earn a CLOSENESS BONUS of up to 250. The Overclock multiplier (up to ×2.5) multiplies the lot. And hints never, ever reduce your score. That's the whole game, Archivist — a live guest is waiting.",
  },
];

export class Tutorial {
  private host: TutorialHost;
  private info: PracticeInfo;
  private card: HTMLElement | null = null;
  private stepIndex = 0;
  private poll: number | null = null;
  private highlighted: HTMLElement | null = null;
  active = false;

  constructor(host: TutorialHost, info: PracticeInfo) {
    this.host = host;
    this.info = info;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.stepIndex = 0;
    this.card = document.createElement("div");
    this.card.id = "tutorial-card";
    this.card.className = "tutorial-card";
    this.card.setAttribute("role", "dialog");
    this.card.setAttribute("aria-label", "Field training tutorial");
    this.card.innerHTML = `
      <div class="panel-head small">VEX-09 · FIELD TRAINING <span id="tut-count" class="tut-count"></span></div>
      <div id="tut-title" class="tut-title"></div>
      <p id="tut-body" class="tut-body"></p>
      <div class="tut-actions">
        <button id="tut-skip" type="button" class="px-btn">SKIP TUTORIAL</button>
        <button id="tut-next" type="button" class="px-btn big">NEXT ▸</button>
      </div>`;
    document.body.append(this.card);
    this.card
      .querySelector("#tut-skip")!
      .addEventListener("click", () => this.close());
    this.card
      .querySelector("#tut-next")!
      .addEventListener("click", () => this.advance());
    this.poll = window.setInterval(() => this.tick(), 200);
    this.render();
  }

  private tick(): void {
    if (!this.active) return;
    const step = STEPS[this.stepIndex];
    if (step.advance !== "next" && step.advance(this.host.state())) {
      this.advance();
    }
  }

  private advance(): void {
    if (!this.active) return;
    if (this.stepIndex >= STEPS.length - 1) {
      this.close();
      return;
    }
    this.stepIndex += 1;
    this.render();
  }

  private render(): void {
    if (!this.card) return;
    const step = STEPS[this.stepIndex];
    this.card.querySelector("#tut-count")!.textContent =
      `· STEP ${this.stepIndex + 1}/${STEPS.length}`;
    this.card.querySelector("#tut-title")!.textContent = step.title;
    this.card.querySelector("#tut-body")!.textContent = step.body(this.info);
    const next = this.card.querySelector<HTMLButtonElement>("#tut-next")!;
    if (step.advance === "next") {
      next.hidden = false;
      next.textContent = step.nextLabel ?? "NEXT ▸";
    } else {
      next.hidden = true;
    }
    if (this.highlighted) {
      this.highlighted.classList.remove("tut-highlight");
      this.highlighted = null;
    }
    if (step.highlight) {
      const el = document.querySelector<HTMLElement>(step.highlight);
      if (el) {
        el.classList.add("tut-highlight");
        this.highlighted = el;
        if (typeof el.scrollIntoView === "function") {
          try {
            el.scrollIntoView({ block: "nearest" });
          } catch {
            /* older engines — highlight alone is enough */
          }
        }
      }
    }
  }

  /** Close the tutorial, persist the seen flag, hand control back. */
  close(): void {
    if (!this.active) return;
    this.active = false;
    if (this.poll !== null) {
      window.clearInterval(this.poll);
      this.poll = null;
    }
    if (this.highlighted) {
      this.highlighted.classList.remove("tut-highlight");
      this.highlighted = null;
    }
    this.card?.remove();
    this.card = null;
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    } catch {
      /* storage unavailable — tutorial will simply offer itself again */
    }
    this.host.onExit();
  }
}
