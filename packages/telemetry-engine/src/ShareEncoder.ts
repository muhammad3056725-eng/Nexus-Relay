/**
 * NEXUS RELAY — Unicode Signal Trace sharecard (Blueprint §2).
 * Spoiler-free: ping rows carry telemetry only, never guessed names.
 * The chain line lists the bridged nodes in link order (Blueprint §2
 * example: "🔗 Saturn V -> NASA -> Neil Armstrong").
 */
import { CHANNELS, DOMAINS } from "@nexus-relay/shared-types";
import { formatYear } from "./MathVector";
import type { Round, PingResult } from "./StateMachine";

function proximitySymbol(p: PingResult): string {
  if (p.exact) return "🟢";
  const close =
    (p.hops != null && p.hops <= 2) ||
    (Math.abs(p.deltaYear) <= 25 && p.spatial != null && p.spatial.km <= 2500);
  return close ? "🟡" : "🔴";
}

function traceHash(round: Round): string {
  let h = 0;
  const s = `${round.roundNumber}:${round.targetId}:${round.pings.length}`;
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(6, "0").slice(0, 6);
}

/**
 * Build the sharecard text for a finished round.
 * @param nameOf entity id -> display name (for the bridge chain line)
 */
export function buildShareCard(
  round: Round,
  nameOf: (id: number) => string
): string {
  const score = round.score();
  const target = round.targetPack;
  const lines: string[] = [];
  const num = String(round.roundNumber).padStart(3, "0");
  lines.push(`NEXUS RELAY #${num} ⚡ ${score.total.toLocaleString("en-US")} SIG`);
  if (round.solved) {
    lines.push(
      `Target: [ ${target.name.toUpperCase()} ] (${formatYear(round.target.year)})`
    );
  } else {
    lines.push("Target: [ NOT LOCKED ] — the signal escaped");
  }
  const left = round.probes;
  lines.push(`Probes: ${"🗲".repeat(6 - left)}${"⬚".repeat(left)} (${left} Left)`);
  lines.push(
    "Clues:  " +
      CHANNELS.map(
        (c) => `[${c.label}: ${round.tuned.has(c.key) ? "🔓" : "🔒"}]`
      ).join(" ")
  );
  lines.push("Pings:");
  round.pings.forEach((p, i) => {
    const dist = p.spatial
      ? `${p.spatial.km.toLocaleString("en-US")}km`
      : "NON-SPATIAL";
    const hops = p.exact ? "TARGET" : p.hops == null ? "—" : `${p.hops} Hops`;
    const dom =
      p.domainShort ?? DOMAINS[round.records.get(p.guessId)!.dom].short;
    lines.push(
      `${i + 1}. ${proximitySymbol(p)} ${formatYear(p.year)} | ${dist} | ${hops} | ${dom}`
    );
  });
  const b = round.bridges.length;
  lines.push(
    `Overclock Surge: ${"⚡".repeat(b)}${"⬚".repeat(3 - b)} (${b}/3 Linked)`
  );
  if (b > 0) {
    lines.push("🔗 " + round.bridges.map((id) => nameOf(id)).join(" -> "));
  }
  lines.push(`Rank: ${score.rank.title}`);
  lines.push(`https://nexusrelay.io/trace/${num}-${traceHash(round)}`);
  return lines.join("\n");
}
