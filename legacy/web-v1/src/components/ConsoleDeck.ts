/**
 * NEXUS RELAY — ConsoleDeck (Blueprint §3 Layer 2: diegetic console
 * deck). Renders the five Frequency Relay cards with tactile
 * 3-frame-style buttons, the Nixie-tube probe counter and the score
 * multiplier readout.
 */
import { CHANNELS, type ChannelKey } from "@nexus-relay/shared-types";
import { clueMultiplier, MAX_PROBES } from "@nexus-relay/telemetry-engine";

export class ConsoleDeck {
  private cards = new Map<ChannelKey, { clueEl: HTMLElement; btn: HTMLButtonElement; lockEl: HTMLElement }>();
  private pipsEl: HTMLElement;
  private multEl: HTMLElement;

  constructor(
    deckRoot: HTMLElement,
    pipsEl: HTMLElement,
    multEl: HTMLElement,
    onTune: (key: ChannelKey) => void
  ) {
    this.pipsEl = pipsEl;
    this.multEl = multEl;
    for (const ch of CHANNELS) {
      const card = document.createElement("div");
      card.className = "relay-card";
      const name = document.createElement("div");
      name.className = "relay-name";
      name.innerHTML = `${ch.label}<span class="axis">${ch.axis.toUpperCase()} BAND</span>`;
      const clue = document.createElement("div");
      clue.className = "relay-clue";
      clue.textContent = "▓▓▓▓ ENCRYPTED ▓▓▓▓";
      const right = document.createElement("div");
      const lock = document.createElement("span");
      lock.className = "relay-lock";
      lock.textContent = "🔒";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "px-btn";
      btn.textContent = "TUNE";
      btn.disabled = true;
      btn.addEventListener("click", () => onTune(ch.key));
      right.append(lock, btn);
      card.append(name, clue, right);
      deckRoot.append(card);
      this.cards.set(ch.key, { clueEl: clue, btn, lockEl: lock });
    }
  }

  render(state: {
    started: boolean;
    hardcore: boolean;
    probes: number;
    tunedClues: Map<ChannelKey, string>;
  }): void {
    for (const ch of CHANNELS) {
      const card = this.cards.get(ch.key)!;
      const clue = state.tunedClues.get(ch.key);
      if (clue != null) {
        card.clueEl.textContent = clue;
        card.clueEl.classList.add("unlocked");
        card.lockEl.textContent = "🔓";
        card.btn.disabled = true;
        card.btn.textContent = "TUNED";
      } else {
        card.clueEl.textContent = state.hardcore
          ? "▓▓ SEALED — HARDCORE ▓▓"
          : "▓▓▓▓ ENCRYPTED ▓▓▓▓";
        card.clueEl.classList.remove("unlocked");
        card.lockEl.textContent = "🔒";
        card.btn.disabled =
          !state.started || state.hardcore || state.probes <= 0;
        card.btn.textContent = "TUNE";
      }
    }
    // Nixie-tube probe counter
    const spent = MAX_PROBES - state.probes;
    this.pipsEl.innerHTML =
      `<span>${"🗲".repeat(state.probes)}</span>` +
      `<span class="spent">${"⬚".repeat(spent)}</span>`;
    this.multEl.textContent = `MULTIPLIER ×${clueMultiplier(state.tunedClues.size).toFixed(2)}`;
  }
}
