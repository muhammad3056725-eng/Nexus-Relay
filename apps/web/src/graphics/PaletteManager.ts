/**
 * NEXUS RELAY — PaletteManager.
 * Base colour palette + sector LUTs; sector themes cross-fade
 * smoothly (alpha blend in the Renderer).
 */

/** BASE COLOUR PALETTE (HEX). */
export const BASE_PALETTE_32: readonly string[] = [
  "#0B0E14", "#121722", "#182338", "#24324D", "#36496B", "#4F678F", "#708AA8", "#A0B5D0",
  "#2CF6B3", "#1DE09D", "#12B87F", "#0B8E60", "#066443", "#FFB627", "#E09819", "#B8760B",
  "#FF2A85", "#D61B6B", "#A80D50", "#7A0537", "#FF6B35", "#E04E1B", "#B8350B", "#8E2004",
  "#8B5CF6", "#7C3AED", "#6D28D9", "#4C1D95", "#F3F4F6", "#D1D5DB", "#9CA3AF", "#4B5563",
];

export interface Sector {
  name: string;
  domains: number[];
  bg: string;
  mid: string;
  accent: string;
  glow: string;
}

/** Sector LUTs: dominant colors per themed band. */
export const SECTORS: readonly Sector[] = [
  { name: "Deep Ocean Cable Vault", domains: [2, 5], bg: "#0B0E14", mid: "#182338", accent: "#2CF6B3", glow: "#12B87F" },
  { name: "1968 Lunar Telemetry Room", domains: [3, 11], bg: "#121722", mid: "#4F678F", accent: "#FFB627", glow: "#E09819" },
  { name: "Ancient Astral Observatory", domains: [1, 10], bg: "#0B0E14", mid: "#B8760B", accent: "#F3F4F6", glow: "#FFB627" },
  { name: "Arctic Ionosphere Station", domains: [8, 12], bg: "#182338", mid: "#708AA8", accent: "#F3F4F6", glow: "#A0B5D0" },
  { name: "Neo-Kyoto Archive Vault", domains: [4, 6, 7], bg: "#121722", mid: "#A80D50", accent: "#FF2A85", glow: "#8B5CF6" },
  { name: "Solar Corona Array", domains: [9], bg: "#0B0E14", mid: "#B8350B", accent: "#FF6B35", glow: "#FFB627" },
];

export function sectorForDomain(dom: number): Sector {
  return SECTORS.find((s) => s.domains.includes(dom)) ?? SECTORS[0];
}

export class PaletteManager {
  current: Sector;
  private previous: Sector | null = null;
  private fadeStart = 0;
  private fadeMs = 900;

  constructor(initial: Sector) {
    this.current = initial;
  }

  /** Begin a cross-fade to a new sector LUT. */
  crossFadeTo(next: Sector, now: number): void {
    if (next.name === this.current.name) return;
    this.previous = this.current;
    this.current = next;
    this.fadeStart = now;
  }

  /** Fade progress 0..1 (1 = fully on the current sector). */
  fadeProgress(now: number): number {
    if (!this.previous) return 1;
    const t = (now - this.fadeStart) / this.fadeMs;
    if (t >= 1) {
      this.previous = null;
      return 1;
    }
    return Math.max(0, t);
  }

  get fadingFrom(): Sector | null {
    return this.previous;
  }

}
