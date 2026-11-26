/**
 * NEXUS RELAY — RelicVaultDB (Blueprint §3/§7): local-first IndexedDB
 * store for unlocked Relic Cards, high scores and run state. Falls
 * back to localStorage where IndexedDB is unavailable.
 */

export interface RelicRecord {
  targetId: number;
  targetName: string;
  domain: number;
  score: number;
  rankTitle: string;
  frameName: string;
  mode: string;
  dateISO: string;
}

const DB_NAME = "nexus-relay-vault";
const DB_VERSION = 1;

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("relics")) {
        db.createObjectStore("relics", { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const LS_RELICS = "nexus-relay:relics";
const LS_BEST = "nexus-relay:best";

export class RelicVaultDB {
  async saveRelic(rec: RelicRecord): Promise<void> {
    if (!idbAvailable()) {
      const all = this.lsRelics();
      all.push(rec);
      localStorage.setItem(LS_RELICS, JSON.stringify(all));
      return;
    }
    const db = await openDb();
    await tx(db, "relics", "readwrite", (s) => s.add(rec));
    db.close();
  }

  async listRelics(): Promise<RelicRecord[]> {
    if (!idbAvailable()) return this.lsRelics();
    const db = await openDb();
    const all = await tx<RelicRecord[]>(db, "relics", "readonly", (s) =>
      s.getAll()
    );
    db.close();
    return all;
  }

  async getBest(): Promise<number> {
    if (!idbAvailable()) {
      return Number(localStorage.getItem(LS_BEST) ?? 0) || 0;
    }
    const db = await openDb();
    const row = await tx<{ key: string; value: number } | undefined>(
      db,
      "meta",
      "readonly",
      (s) => s.get("best")
    );
    db.close();
    return row?.value ?? 0;
  }

  async setBest(score: number): Promise<void> {
    if (!idbAvailable()) {
      localStorage.setItem(LS_BEST, String(score));
      return;
    }
    const db = await openDb();
    await tx(db, "meta", "readwrite", (s) =>
      s.put({ key: "best", value: score })
    );
    db.close();
  }

  private lsRelics(): RelicRecord[] {
    try {
      return JSON.parse(localStorage.getItem(LS_RELICS) ?? "[]") as RelicRecord[];
    } catch {
      return [];
    }
  }
}
