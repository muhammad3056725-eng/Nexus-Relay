/**
 * NEXUS RELAY — web application lifecycle (Blueprint §6: main.ts).
 * Wires the telemetry engine to the diegetic console: ConsoleDeck
 * (relays), TelemetryPanel (ping readouts), Renderer (WebGL2 CRT
 * scene), MascotVex09 (operator), AudioSynth (chiptune stems),
 * RelicCard + RelicVaultDB (collectibles).
 *
 * Modes (Blueprint §2): Daily Global Broadcast (seeded 00:00 UTC),
 * Endless Sector Expeditions (themed bands, 3-strike survival),
 * Zero-Clue Blind Triangulation (hardcore: relays sealed).
 */
import {
  CHANNELS,
  DOMAINS,
  decodeClue,
  type ChannelKey,
  type ShardEntity,
} from "@nexus-relay/shared-types";
import {
  Round,
  buildShareCard,
  dailySeed,
  formatYear,
  rankFor,
  type PingResult,
} from "@nexus-relay/telemetry-engine";
import { Dataset } from "./data";
import { Renderer, drawScope, type CrtIntensity } from "./graphics/Renderer";
import { sectorForDomain } from "./graphics/PaletteManager";
import { ConsoleDeck } from "./components/ConsoleDeck";
import { Tutorial, TUTORIAL_SEEN_KEY } from "./components/Tutorial";
import { TelemetryPanel, escapeHtml, proximityClass } from "./components/TelemetryPanel";
import { RelicCard } from "./components/RelicCard";
import { RelicVaultDB } from "./storage/RelicVaultDB";
import { AudioSynth } from "./audio/AudioSynth";
import type { VexState } from "./graphics/MascotVex09";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const LAUNCH_EPOCH_DAYS = Math.floor(Date.UTC(2026, 0, 1) / 86400000);

type Mode = "daily" | "endless";

class Game {
  private ds!: Dataset;
  private renderer!: Renderer;
  private deck!: ConsoleDeck;
  private panel!: TelemetryPanel;
  private relic!: RelicCard;
  private vault = new RelicVaultDB();
  private audio = new AudioSynth();

  private round: Round | null = null;
  private mode: Mode = "daily";
  private hardcore = false;
  private tutorial: Tutorial | null = null;
  private practice = false;
  private started = false;
  private finished = false;
  private tunedClues = new Map<ChannelKey, string>();
  private stage = 1;
  private strikes = 0;
  private runTotal = 0;
  private scopeLevel = 0.12;
  private overclockInterval: number | null = null;
  private mascotRevert: number | null = null;
  private relicVisible = false;

  async boot(): Promise<void> {
    this.wireSettings();
    this.renderer = new Renderer($<HTMLCanvasElement>("scene"));
    this.applyCrtSetting();
    this.deck = new ConsoleDeck(
      $("relay-deck"),
      $("probe-pips"),
      $("multiplier-readout"),
      (key) => this.onTune(key)
    );
    this.panel = new TelemetryPanel($("telemetry-log"));
    this.relic = new RelicCard($<HTMLCanvasElement>("relic-canvas"));
    this.wireControls();

    try {
      this.ds = await Dataset.load();
      const m = this.ds.manifest;
      $("dataset-line").textContent =
        `DATASET v${m.version} · ${m.entity_count} ENTITIES · ${m.edge_count} EDGES · ` +
        `CORPUS: ${m.corpus.toUpperCase()} (production target 250,000 entities / 1.5M edges — Blueprint §4)`;
    } catch (err) {
      $("dataset-line").textContent = `DATASET LOAD FAILED: ${String(err)}`;
      $("mascot-line").textContent =
        "The archive is unreachable, Archivist. Check the data feed and reload.";
      return;
    }
    this.fitRenderer();
    window.addEventListener("resize", () => this.fitRenderer());
    this.newRound();
    await this.updateVaultLine();
    // First-run FIELD TRAINING: auto-show once per Archivist (the seen
    // flag lives in localStorage beside the vault keys). Re-openable
    // anytime via the FIELD TRAINING header button.
    let tutorialSeen = true;
    try {
      tutorialSeen = localStorage.getItem(TUTORIAL_SEEN_KEY) === "1";
    } catch {
      tutorialSeen = true; // storage blocked — never trap the player
    }
    if (!tutorialSeen) this.startTutorial();
    requestAnimationFrame((now) => this.loop(now));
  }

  // ------------------------------------------------------------ wiring
  private wireControls(): void {
    $("begin-btn").addEventListener("click", () => {
      this.audio.click();
      this.begin();
    });
    $("mode-daily").addEventListener("click", () => this.setMode("daily"));
    $("mode-endless").addEventListener("click", () => this.setMode("endless"));
    $("tutorial-btn").addEventListener("click", () => {
      this.audio.click();
      this.startTutorial();
    });
    $<HTMLInputElement>("hardcore").addEventListener("change", (ev) => {
      this.hardcore = (ev.target as HTMLInputElement).checked;
      this.newRound();
    });
    $("ping-btn").addEventListener("click", () => {
      this.audio.click();
      void this.onPing();
    });
    $("bridge-btn").addEventListener("click", () => {
      this.audio.click();
      void this.onBridge();
    });
    $<HTMLInputElement>("hypothesis-input").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") void this.onPing();
    });
    $<HTMLInputElement>("bridge-input").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") void this.onBridge();
    });
    this.pingSelect = this.wireAutocomplete(
      $<HTMLInputElement>("hypothesis-input"),
      $("autocomplete")
    );
    this.bridgeSelect = this.wireAutocomplete(
      $<HTMLInputElement>("bridge-input"),
      $("bridge-autocomplete")
    );
    $("copy-share").addEventListener("click", () => {
      const text = $<HTMLPreElement>("share-card").textContent ?? "";
      void navigator.clipboard?.writeText(text);
      $("copy-share").textContent = "COPIED ✓";
      window.setTimeout(() => ($("copy-share").textContent = "COPY SIGNAL TRACE"), 1400);
    });
    $("again-btn").addEventListener("click", () => {
      this.audio.click();
      this.onAgain();
    });
  }

  private wireSettings(): void {
    $<HTMLSelectElement>("crt-select").addEventListener("change", () =>
      this.applyCrtSetting()
    );
    $<HTMLInputElement>("reduced-motion").addEventListener("change", (ev) => {
      const on = (ev.target as HTMLInputElement).checked;
      document.body.classList.toggle("reduced-motion", on);
      if (this.renderer) this.renderer.reducedMotion = on;
    });
    $<HTMLInputElement>("high-contrast").addEventListener("change", (ev) => {
      document.body.classList.toggle(
        "high-contrast",
        (ev.target as HTMLInputElement).checked
      );
    });
    $<HTMLInputElement>("font-toggle").addEventListener("change", (ev) => {
      document.body.classList.toggle(
        "legible",
        (ev.target as HTMLInputElement).checked
      );
    });
    $<HTMLInputElement>("sound-toggle").addEventListener("change", (ev) => {
      this.audio.enabled = (ev.target as HTMLInputElement).checked;
      if (!this.audio.enabled) this.audio.stopMusic();
    });
  }

  private applyCrtSetting(): void {
    const level = $<HTMLSelectElement>("crt-select").value as CrtIntensity;
    this.renderer.setCrtIntensity(level);
    const overlay = $("crt-overlay");
    // WebGL2 path: the shader performs the CRT pass. Fallback: CSS.
    overlay.className = this.renderer.webglActive ? "crt-off" : `crt-${level}`;
  }

  private fitRenderer(): void {
    const panel = document.querySelector(".core-panel");
    if (panel && this.renderer) {
      this.renderer.fit(Math.min(panel.clientWidth - 24, 960));
    }
  }

  private wireAutocomplete(
    input: HTMLInputElement,
    box: HTMLElement
  ): { getSelected: () => number | null } {
    let selected: number | null = null;
    let results: ShardEntity[] = [];
    input.addEventListener("input", () => {
      selected = null;
      const q = input.value;
      if (q.trim().length < 2) {
        box.hidden = true;
        return;
      }
      void this.ds.search(q).then((hits) => {
        results = hits;
        if (!hits.length) {
          box.hidden = true;
          return;
        }
        box.innerHTML = "";
        for (const hit of hits) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.innerHTML = `${escapeHtml(hit.name)} <span class="sub">${escapeHtml(hit.sub)}</span>`;
          btn.addEventListener("click", () => {
            input.value = hit.name;
            selected = hit.id;
            box.hidden = true;
            input.focus();
          });
          box.append(btn);
        }
        box.hidden = false;
      });
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => (box.hidden = true), 150);
    });
    return {
      getSelected: () => {
        if (selected != null) return selected;
        const q = input.value.trim().toLowerCase();
        const exact = results.find(
          (r) =>
            r.name.toLowerCase() === q ||
            r.alt.some((a) => a.toLowerCase() === q)
        );
        return exact ? exact.id : results.length === 1 ? results[0].id : null;
      },
    };
  }

  private pingSelect!: { getSelected: () => number | null };
  private bridgeSelect!: { getSelected: () => number | null };

  // ------------------------------------------------------------ rounds
  private setMode(mode: Mode): void {
    this.mode = mode;
    $("mode-daily").classList.toggle("active", mode === "daily");
    $("mode-endless").classList.toggle("active", mode === "endless");
    this.stage = 1;
    this.strikes = 0;
    this.runTotal = 0;
    this.newRound();
  }

  private pickDailyTarget(): { targetId: number; roundNumber: number } {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const seed = dailySeed(dateStr);
    const ids = [...this.ds.records.keys()];
    const days = Math.floor(now.getTime() / 86400000);
    return {
      targetId: ids[seed % ids.length],
      roundNumber: days - LAUNCH_EPOCH_DAYS + 1,
    };
  }

  private pickExpeditionTarget(): { targetId: number; roundNumber: number } {
    // Themed frequency bands: stages rotate through the sector LUTs.
    const sectors = [
      [3, 11], [1, 10], [2, 5], [4, 6, 7], [8, 12], [9],
    ];
    const band = sectors[(this.stage - 1) % sectors.length];
    const pool = [...this.ds.records.values()].filter((r) =>
      band.includes(r.dom)
    );
    const rec = pool[Math.floor(Math.random() * pool.length)];
    return { targetId: rec.id, roundNumber: this.stage };
  }

  private newRound(forcedTargetId?: number): void {
    this.stopOverclock();
    this.practice = forcedTargetId != null;
    const pick =
      forcedTargetId != null
        ? { targetId: forcedTargetId, roundNumber: 0 }
        : this.mode === "daily"
          ? this.pickDailyTarget()
          : this.pickExpeditionTarget();
    this.round = new Round({
      targetId: pick.targetId,
      records: this.ds.records,
      pack: this.ds.pack,
      adjacency: this.ds.adjacency,
      roundNumber: pick.roundNumber,
      hardcore: this.hardcore,
    });
    this.started = false;
    this.finished = false;
    this.tunedClues.clear();
    this.panel.clear();
    $("results-box").hidden = true;
    $("overclock-box").hidden = true;
    this.relicVisible = false;
    $<HTMLInputElement>("hypothesis-input").value = "";
    $<HTMLInputElement>("bridge-input").value = "";
    $("bridge-log").innerHTML = "";
    const beginBtn = $<HTMLButtonElement>("begin-btn");
    beginBtn.disabled = false;
    beginBtn.textContent = "▶ BEGIN TRIANGULATION";

    const target = this.round.target;
    const now = performance.now();
    this.renderer.setSector(target.dom, now);
    this.renderer.setRevealed(null);
    this.setMascot("IDLE_BLINK");
    if (this.hardcore) {
      $("core-label").textContent = `DOMAIN STATIC: ${DOMAINS[target.dom].name.toUpperCase()} — RELAYS SEALED`;
      $("mascot-line").textContent =
        "Zero-clue run, Archivist. No relay will open. Your pings are all you have.";
    } else {
      $("core-label").textContent = "SIGNAL INTERCEPTED — ENTITY SEALED";
      $("mascot-line").textContent =
        "Carrier locked. Five relays cold. Six capacitor charges on the rail, Archivist.";
    }
    $("round-label").textContent = this.practice
      ? "PRACTICE ROUND · FIELD TRAINING SIGNAL"
      : this.mode === "daily"
        ? `DAILY #${String(pick.roundNumber).padStart(3, "0")} · ${new Date().toISOString().slice(0, 10)} UTC`
        : `STAGE ${this.stage} · STRIKES ${this.strikes}/3 · RUN ${this.runTotal.toLocaleString()} SIG`;
    this.audio.stopMusic();
    this.renderDeck();
  }

  private begin(): void {
    if (!this.round || this.started) return;
    this.started = true;
    const beginBtn = $<HTMLButtonElement>("begin-btn");
    beginBtn.disabled = true;
    beginBtn.textContent = "TRIANGULATION ACTIVE";
    $("core-label").textContent = "TRIANGULATION IN PROGRESS";
    this.setMascot("LISTENING");
    $("mascot-line").textContent =
      "Scope is live. Tune a relay to decrypt — or trust your instincts and ping.";
    this.audio.startMusic();
    this.audio.setMusicLevel(0);
    this.renderDeck();
  }

  private renderDeck(): void {
    if (!this.round) return;
    this.deck.render({
      started: this.started && !this.finished,
      hardcore: this.hardcore,
      probes: this.round.probes,
      tunedClues: this.tunedClues,
    });
  }

  private setMascot(state: VexState, revertAfterMs?: number): void {
    this.renderer.mascot.setState(state, performance.now());
    if (this.mascotRevert) window.clearTimeout(this.mascotRevert);
    if (revertAfterMs != null) {
      this.mascotRevert = window.setTimeout(() => {
        if (!this.round) return;
        this.setMascot(
          this.round.phase === 3
            ? "OVERCLOCK_SURGE"
            : this.started && !this.finished
              ? "LISTENING"
              : "IDLE_BLINK"
        );
      }, revertAfterMs);
    }
  }

  // ------------------------------------------------------------ actions
  private onTune(key: ChannelKey): void {
    if (!this.round || !this.started || this.finished) return;
    try {
      const clue = this.round.tune(key, decodeClue);
      this.tunedClues.set(key, clue);
      this.audio.whir();
      this.setMascot("DECRYPTION_FOCUS", 1300);
      $("mascot-line").textContent = `${key.toUpperCase()} relay decrypted. The signal narrows.`;
      this.renderDeck();
      if (this.round.failed) this.finish();
    } catch {
      /* relay already tuned / sealed — deck state already reflects it */
    }
  }

  private async onPing(): Promise<void> {
    if (!this.round || !this.started || this.finished) return;
    const input = $<HTMLInputElement>("hypothesis-input");
    const id = await this.resolveEntity(input, this.pingSelect);
    if (id == null) {
      input.classList.add("shake");
      window.setTimeout(() => input.classList.remove("shake"), 350);
      this.setMascot("ERROR_GLITCH", 900);
      $("mascot-line").textContent =
        "No such entity in the archive index. Check the name and ping again.";
      return;
    }
    if (this.round.pings.some((p) => p.guessId === id)) {
      $("mascot-line").textContent =
        "You already pinged that node. The vector would not change.";
      return;
    }
    const result = this.round.ping(id);
    input.value = "";
    this.panel.addPing(result);
    this.audio.ping(result.spatial ? result.spatial.km : null);
    this.scopeLevel = result.exact
      ? 1
      : proximityClass(result) === "warm"
        ? 0.65
        : 0.3;
    const sector = sectorForDomain(this.round.target.dom);
    this.renderer.burst(sector.accent, result.exact ? 42 : 16);
    const pingCount = this.round.pings.length;
    this.audio.setMusicLevel(pingCount >= 4 ? 2 : pingCount >= 2 ? 1 : 0);
    if (result.exact) {
      this.startOverclock();
    } else {
      this.setMascot(
        proximityClass(result) === "cold" ? "COLD_STATIC" : "SIGNAL_SPIKE",
        1500
      );
      $("mascot-line").textContent = this.pingCommentary(result);
      if (this.round.failed) this.finish();
    }
    this.renderDeck();
  }

  private pingCommentary(p: PingResult): string {
    if (p.hops === 1) return "Direct neighbour! You are one hop from the core.";
    if (p.hops != null && p.hops <= 2)
      return `Two hops out${p.via ? ` via ${p.via}` : ""}. The trail is warm.`;
    if (p.resonance === "EXACT MATCH")
      return "Same sub-domain. You are circling the right sector.";
    if (p.spatial && p.spatial.km > 8000)
      return "Cold static. That vector points across the planet — pivot.";
    return "Telemetry logged. Compare the axes and triangulate.";
  }

  private async resolveEntity(
    input: HTMLInputElement,
    selector: { getSelected: () => number | null }
  ): Promise<number | null> {
    const chosen = selector?.getSelected();
    if (chosen != null) return chosen;
    const hits = await this.ds.search(input.value);
    const q = input.value.trim().toLowerCase();
    const exact = hits.find(
      (h) =>
        h.name.toLowerCase() === q || h.alt.some((a) => a.toLowerCase() === q)
    );
    if (exact) return exact.id;
    return hits.length === 1 ? hits[0].id : null;
  }

  // ------------------------------------------------------------ overclock
  private startOverclock(): void {
    if (!this.round) return;
    this.audio.victory();
    this.audio.setMusicLevel(2);
    this.setMascot("OVERCLOCK_SURGE");
    this.renderer.setRevealed(this.round.target.dom);
    $("core-label").textContent = "TARGET LOCKED — OVERCLOCK SURGE";
    $("mascot-line").textContent =
      "LOCK! Fifteen seconds — name what connects to it before the capacitor drains!";
    const box = $("overclock-box");
    box.hidden = false;
    const beams = $("beam-list");
    beams.innerHTML = "";
    for (const beam of this.round.overclockBeams()) {
      const chip = document.createElement("span");
      chip.className = "beam";
      chip.dataset.target = String(beam.targetId);
      chip.textContent = `⚡ ${beam.rel}`;
      beams.append(chip);
    }
    $("bridge-log").innerHTML = "";
    const endsAt = performance.now() + 15000;
    const timerEl = $("overclock-timer");
    this.overclockInterval = window.setInterval(() => {
      const left = Math.max(0, endsAt - performance.now());
      timerEl.textContent = (left / 1000).toFixed(1);
      if (left <= 0) this.finish();
    }, 50);
    $<HTMLInputElement>("bridge-input").focus();
  }

  private stopOverclock(): void {
    if (this.overclockInterval !== null) {
      window.clearInterval(this.overclockInterval);
      this.overclockInterval = null;
    }
  }

  private async onBridge(): Promise<void> {
    if (!this.round || this.round.phase !== 3 || this.finished) return;
    const input = $<HTMLInputElement>("bridge-input");
    const id = await this.resolveEntity(input, this.bridgeSelect);
    if (id == null) {
      input.classList.add("shake");
      window.setTimeout(() => input.classList.remove("shake"), 350);
      return;
    }
    if (this.round.bridge(id)) {
      this.audio.zap();
      input.value = "";
      const name = this.ds.nameOf(id);
      $("bridge-log").innerHTML += `⚡ LINKED: ${escapeHtml(name)} (×${(1 + 0.5 * this.round.bridges.length).toFixed(1)})<br>`;
      document
        .querySelectorAll<HTMLElement>(".beam")
        .forEach((chip) => {
          if (chip.dataset.target === String(id)) chip.classList.add("linked");
        });
      if (this.round.bridges.length >= 3) this.finish();
    } else {
      input.classList.add("shake");
      window.setTimeout(() => input.classList.remove("shake"), 350);
      this.setMascot("ERROR_GLITCH", 700);
    }
  }

  // ------------------------------------------------------------ tutorial
  /** Live engine state the tutorial polls to advance its action steps. */
  tutorialState() {
    return {
      started: this.started,
      finished: this.finished,
      solved: this.round?.solved ?? false,
      probes: this.round?.probes ?? 0,
      pings: this.round?.pings.length ?? 0,
      tuned: this.tunedClues.size,
      bridges: this.round?.bridges.length ?? 0,
      phase: this.round?.phase ?? 1,
    };
  }

  /**
   * Deterministic practice target: the lowest-id entity that can teach
   * every system — all five clue channels present, spatial coordinates
   * (so the SPACE axis is live) and at least 3 outgoing beams for the
   * Overclock. The suggested first ping is its first graph neighbour
   * (adjacency is bidirectional, so it always reads exactly 1 hop).
   */
  private pickPracticeTarget(): { targetId: number; neighbourName: string } {
    const ids = [...this.ds.records.keys()].sort((a, b) => a - b);
    for (const id of ids) {
      const rec = this.ds.records.get(id)!;
      const packEnt = this.ds.pack.get(id);
      if (!packEnt) continue;
      const edges = packEnt.edges ?? [];
      if (rec.lat == null || rec.lon == null) continue;
      if (edges.length < 3) continue;
      if (CHANNELS.some((c) => !packEnt.clues?.[c.key])) continue;
      return { targetId: id, neighbourName: this.ds.nameOf(edges[0].target_id) };
    }
    const fallback = ids[0];
    return { targetId: fallback, neighbourName: this.ds.nameOf(ids[1] ?? fallback) };
  }

  /** Open FIELD TRAINING: a scripted practice round on the real console. */
  startTutorial(): void {
    if (this.tutorial?.active || !this.ds) return;
    const pick = this.pickPracticeTarget();
    this.newRound(pick.targetId);
    this.begin();
    this.tutorial = new Tutorial(
      {
        state: () => this.tutorialState(),
        onExit: () => this.exitTutorial(),
      },
      {
        targetName: this.ds.nameOf(pick.targetId),
        neighbourName: pick.neighbourName,
      }
    );
    this.tutorial.start();
    $("mascot-line").textContent =
      "Training signal sealed. Follow the field-training card, Archivist.";
  }

  private exitTutorial(): void {
    this.tutorial = null;
    // Hand the Archivist a fresh live round, unstarted, on the real mode.
    this.newRound();
    $("mascot-line").textContent =
      "Training closed. A live signal is on the rail — begin when ready.";
  }

  // ------------------------------------------------------------ finish
  private finish(): void {
    if (!this.round || this.finished) return;
    this.finished = true;
    this.stopOverclock();
    this.audio.stopMusic();
    const round = this.round;
    const solved = round.solved;
    if (solved) {
      this.setMascot(round.bridges.length >= 3 ? "CELEBRATION_DANCE" : "VICTORY_SALUTE");
    } else {
      this.audio.fail();
      this.setMascot("CAPACITOR_OVERLOAD");
      this.renderer.setRevealed(round.target.dom);
    }
    const score = round.score();
    const target = round.targetPack;
    const targetRec = round.target;
    const results = $("results-body");
    results.innerHTML = `
      <div class="score-line"><span>${solved ? "TARGET LOCKED" : "SIGNAL LOST — TARGET WAS"}</span><b>${escapeHtml(target.name)}</b></div>
      <div class="score-line"><span>Designation</span><b>${escapeHtml(target.sub)} · ${formatYear(targetRec.year)}</b></div>
      <div class="score-line"><span>Base solve score</span><b>${score.base.toLocaleString()}</b></div>
      <div class="score-line"><span>Proximity bonus</span><b>${score.proximity.toLocaleString()}</b></div>
      <div class="score-line"><span>Overclock multiplier</span><b>×${score.multiplier.toFixed(1)}</b></div>
      <div class="score-line"><span>TOTAL SIGNAL INTEGRITY</span><b>${score.total.toLocaleString()} SIG</b></div>
      <div class="rank-line">RANK: ${score.rank.title.toUpperCase()} — ${score.rank.frame} casing</div>`;
    if (solved) {
      this.relic.draw(targetRec.dom, score.rank.title);
      this.relicVisible = true;
      // Practice rounds are training only — they never mint vault relics.
      if (!this.practice) {
        void this.vault
          .saveRelic({
            targetId: round.targetId,
            targetName: target.name,
            domain: targetRec.dom,
            score: score.total,
            rankTitle: score.rank.title,
            frameName: this.relic.frameName,
            mode: this.mode,
            dateISO: new Date().toISOString(),
          })
          .then(() => this.updateVaultLine());
      }
    } else {
      this.relicVisible = false;
      $<HTMLCanvasElement>("relic-canvas").style.display = "none";
    }
    if (solved) $<HTMLCanvasElement>("relic-canvas").style.display = "";
    $<HTMLPreElement>("share-card").textContent = buildShareCard(
      round,
      (id) => this.ds.nameOf(id)
    );
    $("results-box").hidden = false;
    $("mascot-line").textContent = solved
      ? this.practice
        ? `Practice lock at ${score.total.toLocaleString()} SIG. In a live round, this is where the relic mints.`
        : `Signal integrity ${score.total.toLocaleString()}. Relic minted in a ${this.relic.frameName} frame. Trace is ready to share.`
      : `The capacitor is spent. It was ${target.name}. Study the trace and re-tune your instincts.`;

    if (this.practice) {
      $<HTMLButtonElement>("again-btn").textContent = "▶ FINISH TRAINING";
    } else if (this.mode === "endless") {
      if (solved) {
        this.runTotal += score.total;
        this.stage += 1;
      } else {
        this.strikes += 1;
      }
      const again = $<HTMLButtonElement>("again-btn");
      again.textContent =
        this.strikes >= 3
          ? "RUN OVER — NEW EXPEDITION"
          : solved
            ? `▶ STAGE ${this.stage} — NEXT SIGNAL`
            : `STRIKE ${this.strikes}/3 — NEXT SIGNAL`;
    } else {
      $<HTMLButtonElement>("again-btn").textContent =
        "▶ NEW SIGNAL (EXPEDITION)";
    }
    this.renderDeck();
  }

  private onAgain(): void {
    if (this.practice) {
      // Leaving the practice round via the report returns to a live round.
      this.tutorial?.close();
      return;
    }
    if (this.mode === "daily") {
      this.setMode("endless");
      this.begin();
      return;
    }
    if (this.strikes >= 3) {
      this.stage = 1;
      this.strikes = 0;
      this.runTotal = 0;
    }
    this.newRound();
    this.begin();
  }

  private async updateVaultLine(): Promise<void> {
    try {
      const [best, relics] = await Promise.all([
        this.vault.getBest(),
        this.vault.listRelics(),
      ]);
      const computedBest = Math.max(
        best,
        ...relics.map((r) => r.score),
        0
      );
      if (computedBest > best) await this.vault.setBest(computedBest);
      $("vault-line").textContent = `Best score: ${computedBest.toLocaleString()} SIG · Relics stored: ${relics.length}`;
    } catch {
      $("vault-line").textContent = "Vault unavailable in this browser.";
    }
  }

  // ------------------------------------------------------------ loop
  private loop(now: number): void {
    this.renderer.frame(now);
    this.scopeLevel = Math.max(0.12, this.scopeLevel * 0.985);
    const sector = this.round
      ? sectorForDomain(this.round.target.dom)
      : sectorForDomain(3);
    drawScope($<HTMLCanvasElement>("scope"), this.scopeLevel, now, sector.accent);
    if (this.relicVisible) this.relic.render(now);
    requestAnimationFrame((t) => this.loop(t));
  }
}

const game = new Game();
void game.boot();
export { game };
