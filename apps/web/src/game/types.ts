/** Dataset v2 types (see scripts/data/AUTHORING.md). */

export interface Link {
  name: string;
  rel: string;
}

export interface Subject {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  sub: string;
  year: number | null;
  region: string;
  difficulty: 1 | 2 | 3;
  clues: string[];
  links: Link[];
  fact?: string;
}

/** Compact index row (public/data/v2/index.json). */
export interface IndexRow {
  id: string;
  n: string;
  c: string;
  s: string;
  y: number | null;
  r: string;
  d: 1 | 2 | 3;
  a?: string[];
}

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  file: string;
  count: number;
}

export interface DataIndex {
  version: string;
  count: number;
  categories: CategoryInfo[];
  subjects: IndexRow[];
}

export type Mode = "daily" | "quick" | "channel" | "endless" | "tutorial";
