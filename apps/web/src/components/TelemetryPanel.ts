/**
 * NEXUS RELAY — TelemetryPanel (Blueprint §2 Phase 2 readouts, §3
 * colorblind symbolic telemetry: ((O)) exact, ▲ close, ■ distant —
 * symbols always accompany the color coding).
 */
import type { PingResult } from "@nexus-relay/telemetry-engine";
import { formatDelta } from "@nexus-relay/telemetry-engine";

/**
 * Hot/cold read of a ping. Presentation only — the underlying 5-axis
 * values are the engine's; these thresholds decide how generously the
 * console *signals* them. Tuned friendly (owner, Nov 26): a ping earns
 * ▲ WARM when ANY axis is genuinely closing — graph within 3 hops, a
 * same-sector-or-better resonance, era within a generation, or a
 * regional spatial fix — so the player always has a warm trail to
 * follow instead of a wall of ■.
 */
export function proximityClass(p: PingResult): "hot" | "warm" | "cold" {
  if (p.exact) return "hot";
  const warm =
    (p.hops != null && p.hops <= 3) ||
    p.resonance === "EXACT MATCH" ||
    p.resonance === "SAME SECTOR" ||
    (Math.abs(p.deltaYear) <= 50 && p.spatial != null && p.spatial.km <= 5000) ||
    (p.spatial != null && p.spatial.km <= 1500) ||
    Math.abs(p.deltaYear) <= 25;
  return warm ? "warm" : "cold";
}

export function proximitySymbol(p: PingResult): string {
  const cls = proximityClass(p);
  return cls === "hot" ? "((O))" : cls === "warm" ? "▲" : "■";
}

/**
 * SIGNAL HEAT 0–100: how hot the ping's BEST axis burns (max, never an
 * average — the strongest signal is the one to follow). Purely a
 * display composite of the same telemetry values; scoring never reads
 * it. Scaled generously: 3 hops out still reads ~62, a same-sector hit
 * reads 80, an era within 50 years reads 90.
 */
export function heatPercent(p: PingResult): number {
  if (p.exact) return 100;
  const clamp = (v: number) => Math.max(4, Math.min(98, Math.round(v)));
  const eraHeat = clamp(100 - Math.abs(p.deltaYear) / 5);
  const spaceHeat =
    p.spatial == null ? 0 : clamp(100 - p.spatial.km / 200);
  const hopsHeat =
    p.hops == null
      ? 8
      : clamp({ 1: 94, 2: 82, 3: 68, 4: 50, 5: 34 }[Math.min(5, p.hops)] ?? 20);
  const resonanceHeat =
    p.resonance === "EXACT MATCH"
      ? 95
      : p.resonance === "SAME SECTOR"
        ? 80
        : p.resonance === "ADJACENT DISCIPLINE"
          ? 52
          : 14;
  return Math.max(eraHeat, spaceHeat, hopsHeat, resonanceHeat);
}

export function verdictLine(p: PingResult): string {
  const cls = proximityClass(p);
  if (cls === "hot") return "TARGET LOCK";
  if (cls === "warm") return "WARM — the trail is closing in";
  return "COLD — pivot on your strongest axis";
}

export class TelemetryPanel {
  private root: HTMLElement;
  private empty: HTMLElement | null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.empty = root.querySelector(".hint");
  }

  clear(): void {
    this.root.innerHTML =
      '<p class="hint">No pings yet. Tune a relay to decrypt a clue, or ping a hypothesis to read its vector against the sealed target.</p>';
  }

  addPing(p: PingResult): void {
    if (this.empty) {
      this.root.innerHTML = "";
      this.empty = null;
    }
    const row = document.createElement("div");
    row.className = "ping-row" + (p.exact ? " exact" : "");
    const cls = proximityClass(p);
    const eraBar = Math.max(
      0,
      Math.min(100, 100 - (Math.abs(p.deltaYear) / 1000) * 100)
    );
    const spaceBar =
      p.spatial == null
        ? 0
        : Math.max(0, Math.min(100, 100 - (p.spatial.km / 20000) * 100));
    const hopsLabel = p.exact
      ? "TARGET LOCK"
      : p.hops == null
        ? "NO PATH"
        : p.hops === 1
          ? "Direct Neighbor!"
          : p.via
            ? `${p.hops} Hops via [${p.via}]`
            : `${p.hops} Hops`;
    const spaceLabel =
      p.spatial == null ? "CONCEPTUAL / NON-SPATIAL" : p.spatial.label;
    const heat = heatPercent(p);
    row.innerHTML = `
      <div class="ping-name"><span class="axis-sym sym-${cls}">${proximitySymbol(p)}</span>${escapeHtml(p.name)}</div>
      <div class="ping-grid">
        <span>ERA <b>${formatDelta(p.deltaYear)}</b><div class="prox-bar"><div class="prox-fill ${cls}" style="width:${eraBar}%"></div></div></span>
        <span>SPACE <b>${spaceLabel}</b><div class="prox-bar"><div class="prox-fill ${cls}" style="width:${spaceBar}%"></div></div></span>
        <span>DOMAIN <b>${p.resonance}</b></span>
        <span>GRAPH <b>${hopsLabel}</b></span>
        <span>NOTABILITY <b>${p.notability}</b></span>
        <span>SECTOR <b>${p.domainShort}</b></span>
      </div>
      <div class="ping-verdict sym-${cls}"><b>${proximitySymbol(p)} ${verdictLine(p)}</b> · SIGNAL HEAT ${heat}%<div class="heat-bar"><div class="heat-fill ${cls}" style="width:${heat}%"></div></div></div>`;
    this.root.prepend(row);
  }
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
