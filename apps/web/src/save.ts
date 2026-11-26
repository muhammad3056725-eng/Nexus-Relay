/**
 * NEXUS RELAY — local save (settings, stats, Signal Archive, daily).
 * Everything lives in one localStorage key; every access is wrapped in
 * try/catch so private windows / blocked storage just play without
 * saving.
 */
export interface Settings {
  sound: boolean;
  music: boolean;
  turbo: boolean;
  /** null = follow the OS "reduce motion" preference. */
  reducedMotion: boolean | null;
  quality: "auto" | "high" | "low";
  contrast: boolean;
}

export interface Stats {
  runs: number;
  rounds: number;
  solved: number;
  firstClue: number;
  links: number;
  bestScore: number;
  bestStreak: number;
  bestEndless: number;
  totalScore: number;
}

export interface ArchiveEntry {
  at: string; // ISO date first solved
  best: number; // best (lowest) clue number
}

export interface DailyResult {
  date: string;
  number: number;
  score: number;
  share: string;
  solved: number;
}

export interface SaveData {
  v: 2;
  settings: Settings;
  stats: Stats;
  archive: Record<string, ArchiveEntry>;
  daily: DailyResult | null;
  dailyStreak: { last: string; count: number };
  tutorialDone: boolean;
}

const KEY = "nexus-relay:v2:save";

export function defaultSave(): SaveData {
  return {
    v: 2,
    settings: { sound: true, music: false, turbo: false, reducedMotion: null, quality: "auto", contrast: false },
    stats: { runs: 0, rounds: 0, solved: 0, firstClue: 0, links: 0, bestScore: 0, bestStreak: 0, bestEndless: 0, totalScore: 0 },
    archive: {},
    daily: null,
    dailyStreak: { last: "", count: 0 },
    tutorialDone: false,
  };
}

export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...base,
      ...data,
      v: 2,
      settings: { ...base.settings, ...(data.settings ?? {}) },
      stats: { ...base.stats, ...(data.stats ?? {}) },
      archive: data.archive && typeof data.archive === "object" ? data.archive : {},
      dailyStreak: { ...base.dailyStreak, ...(data.dailyStreak ?? {}) },
    };
  } catch {
    return base;
  }
}

export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}
