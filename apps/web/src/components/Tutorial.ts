/**
 * NEXUS RELAY — first-run FIELD TRAINING (guided practice round).
 *
 * A coach card in the console's own CRT/pixel style walks a new
 * Archivist through one scripted practice round played on the REAL
 * controls and the REAL engine (no mock state): tune a relay, ping a
 * hypothesis, read all five telemetry axes, lock the target, ride the
 * Overclock. Every number quoted in the coach copy is the implemented
 * formula (ScoringSystem.ts / StateMachine.ts), not a paraphrase:
 *   - 6 probes; Tune and Ping each spend exactly 1 probe.
 *   - Clue multiplier = 1.00 - 0.09 per tuned relay (floor x0.55).
 *   - Base = 1000 x (probes left / 6) x clue multiplier.
 *   - Proximity bonus = max(0, 250 - sum over missed pings of
 *     (km/1000 + |era delta|/10)).
 *   - Overclock = 15 s; each valid chain-bridge adds x0.5, max x2.5.
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
    id: "sealed",
    title: "THE SEALED ENTITY",
    highlight: ".core-panel",
    advance: "next",
    body: () =>
      "A real-world entity — a person, place, event, invention, creature — is sealed inside the Containment Core. You know nothing about it except that it sits somewhere in the knowledge graph. Your job: name it exactly. This is a practice round on a training signal, played with the real console. Nothing here touches your vault.",
  },
  {
    id: "probes",
    title: "SIX PROBES — NO MORE",
    highlight: ".probes-row",
    advance: "next",
    body: () =>
      "The Nixie rail holds exactly 6 probes. Every action you take — tuning a relay or pinging a hypothesis — spends 1 probe. Spend all 6 without locking the target and the signal is lost. Probes left over are worth score, so deduction beats guessing.",
  },
  {
    id: "tune",
    title: "ACTION 1 · TUNE-A-RELAY",
    highlight: "#relay-deck",
    advance: (s) => s.tuned >= 1,
    body: () =>
      "Five relays guard five clue channels: ALPHA (Era), BETA (Space), GAMMA (Domain), DELTA (Relational), EPSILON (Trait). Tuning one spends 1 probe and decrypts its clue — but each tuned clue cuts your score multiplier by 9% (x1.00 down to x0.55 if you tune all five). ▸ Press any TUNE button now.",
  },
  {
    id: "ping",
    title: "ACTION 2 · PING-A-HYPOTHESIS",
    highlight: ".hypothesis-box",
    advance: (s) => s.pings >= 1,
    body: (info) =>
      `Or skip clues and test a name directly. Pinging spends 1 probe and fires your guess at the target: the Telemetry Log answers with a five-axis comparison of YOUR entity against the sealed one. ▸ For practice, ping "${info.neighbourName}" — a node wired straight to the target — and watch the log.`,
  },
  {
    id: "axis-era",
    title: "READING THE AXES · 1/5 ERA",
    highlight: ".telemetry-panel",
    advance: "next",
    body: () =>
      "ERA is the signed gap between your guess's year and the target's year. +42 yrs means your guess is 42 years NEWER than the target — step back in time. -118 yrs means your guess is older — move forward. EXACT YEAR LOCK means the years match. The bar drains as the gap grows.",
  },
  {
    id: "axis-space",
    title: "READING THE AXES · 2/5 SPACE",
    highlight: ".telemetry-panel",
    advance: "next",
    body: () =>
      "SPACE is the great-circle distance between the two entities' coordinates, in kilometres, with an 8-wind compass bearing pointing from your guess toward the target. Some entities have no coordinates at all — the axis then reads CONCEPTUAL / NON-SPATIAL and simply gives you nothing.",
  },
  {
    id: "axis-domain",
    title: "READING THE AXES · 3/5 DOMAIN",
    highlight: ".telemetry-panel",
    advance: "next",
    body: () =>
      "DOMAIN resonance compares fields of knowledge. EXACT MATCH: same domain AND sub-domain — you are on the node’s home turf. SAME SECTOR: same domain, different sub-domain. ADJACENT DISCIPLINE: a neighbouring field. ORTHOGONAL FIELD: unrelated — pivot.",
  },
  {
    id: "axis-graph",
    title: "READING THE AXES · 4/5 GRAPH HOPS",
    highlight: ".telemetry-panel",
    advance: "next",
    body: () =>
      "GRAPH counts the shortest path between your guess and the target along the knowledge graph's links. 1 hop = a direct neighbour. On a 2-hop path the log names the bridge node (\"2 Hops via […]\") — pinging that bridge is often the fastest way in. NO PATH means the two nodes are disconnected.",
  },
  {
    id: "axis-notability",
    title: "READING THE AXES · 5/5 NOTABILITY",
    highlight: ".telemetry-panel",
    advance: "next",
    body: () =>
      "NOTABILITY compares fame tiers. SAME TIER: your guess is exactly as famous as the target. NEAR TIER: one tier apart — the log tells you whether the TARGET is more famous or more obscure. FAR TIER: two or more apart — pivot toward fame, or away from it, as directed.",
  },
  {
    id: "lock",
    title: "TRIANGULATE · LOCK THE TARGET",
    highlight: ".hypothesis-box",
    advance: (s) => s.solved || s.finished,
    body: (info) =>
      `In a live round you would now cross-read the axes, narrow the field, and ping the entity itself. A ping that names the target exactly is a TARGET LOCK. ▸ For practice, the sealed entity is "${info.targetName}" — ping it now and watch what a lock triggers.`,
  },
  {
    id: "overclock",
    title: "OVERCLOCK · CHAIN-BRIDGING",
    highlight: "#overclock-box",
    advance: (s) => s.bridges >= 1 || s.finished,
    body: () =>
      "A lock ignites the 15-second Overclock Surge. The three beams are the target's outgoing links, labelled by relationship. Type any entity connected to the target — or connected to a node you have already linked (that is chain-bridging) — before the capacitor drains. Each valid link adds x0.5 to your score, up to x2.5 for 3 links. ▸ Link one now, if the surge is still live.",
  },
  {
    id: "score",
    title: "SIGNAL INTEGRITY · THE MATH",
    highlight: null,
    advance: "next",
    nextLabel: "ENTER THE CONSOLE ▸",
    body: () =>
      "Your score, exactly as computed: BASE = 1,000 x (probes left / 6) x clue multiplier. PROXIMITY BONUS = up to 250, shrinking by (km/1,000 + |era gap|/10) for every missed ping. TOTAL = (BASE + PROXIMITY) x OVERCLOCK multiplier, rounded. Solve fast, tune sparingly, chain hard. Training complete, Archivist — a live signal is waiting.",
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
