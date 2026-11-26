/**
 * NEXUS RELAY — TelemetryPanel (Blueprint §2 Phase 2 readouts, §3
 * colorblind symbolic telemetry: ((O)) exact, ▲ close, ■ distant —
 * symbols always accompany the color coding).
 */
import type { PingResult } from "@nexus-relay/telemetry-engine";
import { formatDelta } from "@nexus-relay/telemetry-engine";

export function proximityClass(p: PingResult): "hot" | "warm" | "cold" {
  if (p.exact) return "hot";
  const close =
    (p.hops != null && p.hops <= 2) ||
    (Math.abs(p.deltaYear) <= 25 && p.spatial != null && p.spatial.km <= 2500);
  return close ? "warm" : "cold";
}

export function proximitySymbol(p: PingResult): string {
  const cls = proximityClass(p);
  return cls === "hot" ? "((O))" : cls === "warm" ? "▲" : "■";
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
    row.innerHTML = `
      <div class="ping-name"><span class="axis-sym sym-${cls}">${proximitySymbol(p)}</span>${escapeHtml(p.name)}</div>
      <div class="ping-grid">
        <span>ERA <b>${formatDelta(p.deltaYear)}</b><div class="prox-bar"><div class="prox-fill" style="width:${eraBar}%"></div></div></span>
        <span>SPACE <b>${spaceLabel}</b><div class="prox-bar"><div class="prox-fill" style="width:${spaceBar}%"></div></div></span>
        <span>DOMAIN <b>${p.resonance}</b></span>
        <span>GRAPH <b>${hopsLabel}</b></span>
        <span>NOTABILITY <b>${p.notability}</b></span>
        <span>SECTOR <b>${p.domainShort}</b></span>
      </div>`;
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
