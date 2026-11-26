/**
 * NEXUS RELAY — dataset v2 loader.
 *
 * First load is only index.json (~70 KB, ~15 KB gzipped): ids, names,
 * categories, years. Clues live in one file per category under
 * subjects/<category>.json and are fetched lazily, the first time a
 * round needs a subject from that category.
 *
 * The data base is resolved against document.baseURI ("public/data/v2"
 * beside the app — the GitHub Pages layout, and the Vite dev mount).
 * A candidate is accepted only if it returns real JSON with the
 * expected shape, so an HTML 200 page (SPA fallback, custom 404) can
 * never be mistaken for the dataset.
 */
import type { CategoryInfo, DataIndex, IndexRow, Subject } from "./game/types";

export const DATA_CANDIDATES = ["public/data/v2", "./public/data/v2", "../../public/data/v2"];

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers?.get?.("content-type") ?? "application/json";
    if (!/json|octet-stream|text\/plain/i.test(type)) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function isIndex(x: unknown): x is DataIndex {
  return (
    !!x &&
    typeof x === "object" &&
    Array.isArray((x as DataIndex).subjects) &&
    Array.isArray((x as DataIndex).categories)
  );
}

export class DataStore {
  base = "";
  index!: DataIndex;
  private rowsById = new Map<string, IndexRow>();
  private subjects = new Map<string, Subject>();
  private loading = new Map<string, Promise<void>>();

  static async load(candidates: readonly string[] = DATA_CANDIDATES): Promise<DataStore> {
    const ds = new DataStore();
    const tried = new Set<string>();
    for (const c of candidates) {
      let base: string;
      try {
        base = new URL(c, typeof document !== "undefined" ? document.baseURI : "http://localhost/").href.replace(/\/$/, "");
      } catch {
        base = c;
      }
      if (tried.has(base)) continue;
      tried.add(base);
      const json = await fetchJson(`${base}/index.json`);
      if (isIndex(json)) {
        ds.base = base;
        ds.index = json;
        for (const r of json.subjects) ds.rowsById.set(r.id, r);
        return ds;
      }
    }
    throw new Error("Could not load the game data.");
  }

  get rows(): IndexRow[] {
    return this.index.subjects;
  }

  get categories(): CategoryInfo[] {
    return this.index.categories.filter((c) => c.count > 0);
  }

  category(id: string): CategoryInfo | undefined {
    return this.index.categories.find((c) => c.id === id);
  }

  row(id: string): IndexRow | undefined {
    return this.rowsById.get(id);
  }

  name(id: string): string {
    return this.rowsById.get(id)?.n ?? id;
  }

  /** Fetch a category's clue file once (shared promise). */
  ensureCategory(cat: string): Promise<void> {
    let p = this.loading.get(cat);
    if (!p) {
      const info = this.category(cat);
      p = (async () => {
        const json = (await fetchJson(`${this.base}/${info?.file ?? `subjects/${cat}.json`}`)) as
          | { subjects?: Subject[] }
          | null;
        if (!json || !Array.isArray(json.subjects)) throw new Error(`Could not load ${cat}`);
        for (const s of json.subjects) this.subjects.set(s.id, s);
      })();
      this.loading.set(cat, p);
      p.catch(() => this.loading.delete(cat));
    }
    return p;
  }

  async subject(id: string): Promise<Subject> {
    const row = this.row(id);
    if (!row) throw new Error(`Unknown subject ${id}`);
    if (!this.subjects.has(id)) await this.ensureCategory(row.c);
    const s = this.subjects.get(id);
    if (!s) throw new Error(`Missing subject ${id}`);
    return s;
  }

  /** Warm the clue files for a list of subjects (in parallel). */
  async preload(ids: readonly string[]): Promise<void> {
    const cats = new Set(ids.map((id) => this.row(id)?.c).filter(Boolean) as string[]);
    await Promise.all([...cats].map((c) => this.ensureCategory(c)));
  }
}
