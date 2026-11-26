/**
 * NEXUS RELAY — casual feedback layer (owner-directed rebuild,
 * Nov 26, 2026: "Simplify it — make it casual and fun").
 *
 * The deep 5-axis telemetry still computes underneath every guess;
 * this module translates ONE ping into plain, friendly language:
 *   🔥 Warmer / ❄️ Colder   — is this guess closer than your last?
 *   ⬆️ Newer / ⬇️ Older     — which way through time is the guest?
 *   ✅ Same field / ❌ Different field — same corner of knowledge?
 * plus a one-line sentence that reads like a friend helping, not an
 * instrument panel. The full telemetry stays one DETAILS tap away.
 */
import type { PingResult } from "@nexus-relay/telemetry-engine";
import { heatPercent, escapeHtml } from "./TelemetryPanel";

/**
 * The mystery guest's TYPE, from the pack's designation ("sub"):
 * "Boxer (1942-2016)" → "a Boxer", "Highest Mountain on Earth" →
 * "the Highest Mountain on Earth", "Our Home Galaxy" → "the Home
 * Galaxy". The year/lifespan parenthetical is stripped — the TYPE is
 * always shown, the dates stay part of the mystery.
 */
export function typeLabel(sub: string): string {
  let clean = sub
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;]+$/, "");
  if (/^our\s+/i.test(clean)) {
    clean = clean.replace(/^our\s+/i, "");
    return `the ${clean}`;
  }
  if (/^(highest|largest|deepest|first|only)\b/i.test(clean)) {
    return `the ${clean}`;
  }
  const article = /^[aeiou]/i.test(clean) ? "an" : "a";
  return `${article} ${clean}`;
}

export interface CasualChips {
  heat: string;
  era: string;
  field: string;
  sentence: string;
}

/** Plain-language feedback for one guess, vs the previous guess. */
export function casualFeedback(
  p: PingResult,
  prev: PingResult | null
): CasualChips {
  if (p.exact) {
    return {
      heat: "🎯 THAT'S THE ONE!",
      era: "",
      field: "",
      sentence: `🎉 YES! ${p.name} — that's your mystery guest!`,
    };
  }

  // 🔥 Warmer / ❄️ Colder — closeness now vs your previous guess.
  const heat = heatPercent(p);
  let heatChip: string;
  let heatWord: string;
  if (prev == null) {
    if (heat >= 70) {
      heatChip = "🔥 Hot start!";
      heatWord = "Hot start!";
    } else if (heat >= 40) {
      heatChip = "🌡️ Warm start";
      heatWord = "A warm start.";
    } else {
      heatChip = "❄️ Cold start";
      heatWord = "A cold start — no problem, every trail starts somewhere.";
    }
  } else {
    const prevHeat = heatPercent(prev);
    if (heat > prevHeat + 2) {
      heatChip = "🔥 Warmer!";
      heatWord = "Warmer!";
    } else if (heat < prevHeat - 2) {
      heatChip = "❄️ Colder";
      heatWord = "Colder that time.";
    } else {
      heatChip = "😐 Same warmth";
      heatWord = "About the same warmth.";
    }
  }

  // ⬆️ Newer / ⬇️ Older — where the GUEST sits vs this guess.
  // deltaYear = guess year − guest year (engine eraDelta).
  let eraChip: string;
  let eraWord: string;
  if (p.deltaYear === 0) {
    eraChip = "📅 Same era!";
    eraWord = "you've nailed the era exactly";
  } else if (p.deltaYear < 0) {
    eraChip = "⬆️ Newer than that";
    eraWord = "the guest is NEWER than that";
  } else {
    eraChip = "⬇️ Older than that";
    eraWord = "the guest is OLDER than that";
  }

  // ✅ Same field / ❌ Different field — domain resonance, plainly.
  let fieldChip: string;
  let fieldWord: string;
  if (p.resonance === "EXACT MATCH") {
    fieldChip = "✅ Same field";
    fieldWord = "same field — same little corner of it, even";
  } else if (p.resonance === "SAME SECTOR") {
    fieldChip = "✅ Same field";
    fieldWord = "same field, too";
  } else if (p.resonance === "ADJACENT DISCIPLINE") {
    fieldChip = "🧭 Neighbouring field";
    fieldWord = "a neighbouring field — close cousins";
  } else {
    fieldChip = "❌ Different field";
    fieldWord = "a different field altogether";
  }

  const sentence =
    `${heatWord} ${p.name} isn't the guest — but ${eraWord}, and it's ${fieldWord}.`;
  return { heat: heatChip, era: eraChip, field: fieldChip, sentence };
}

/** The friendly guess feed: one card per guess, newest on top. */
export class GuessFeed {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  clear(): void {
    this.root.innerHTML =
      '<p class="hint">No guesses yet — type a name above and take your first shot. Every guess teaches you something.</p>';
  }

  addGuess(p: PingResult, prev: PingResult | null): void {
    const chips = casualFeedback(p, prev);
    if (this.root.querySelector(".hint")) this.root.innerHTML = "";
    const card = document.createElement("div");
    card.className = "guess-card" + (p.exact ? " exact" : "");
    const chipsHtml = [chips.heat, chips.era, chips.field]
      .filter((c) => c.length > 0)
      .map((c) => `<span class="chip">${escapeHtml(c)}</span>`)
      .join("");
    card.innerHTML = `
      <div class="guess-name">${escapeHtml(p.name)}</div>
      <div class="chip-row">${chipsHtml}</div>
      <p class="guess-sentence">${escapeHtml(chips.sentence)}</p>`;
    this.root.prepend(card);
  }
}
