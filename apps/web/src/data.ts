/**
 * NEXUS RELAY — client dataset loader (Blueprint §4: zero-backend
 * static edge architecture). Loads the manifest, the packed 24-byte
 * telemetry store (telemetry.bin; telemetry.json mirror as fallback),
 * the clue/edge packs, and fetches 2-character trie shards on demand
 * for autocomplete.
 */
import {
  loadManifest,
  resolveDataBase,
  shardPrefix,
  type CluePack,
  type DatasetManifest,
  type PackEntity,
  type ShardEntity,
  type TelemetryRecord,
  type TrieShard,
} from "@nexus-relay/shared-types";
import { buildAdjacency, type Adjacency } from "@nexus-relay/telemetry-engine";

export class Dataset {
  base = "";
  manifest!: DatasetManifest;
  readonly records = new Map<number, TelemetryRecord>();
  readonly pack = new Map<number, PackEntity>();
  adjacency!: Adjacency;
  private shardCache = new Map<string, ShardEntity[]>();

  static async load(): Promise<Dataset> {
    const ds = new Dataset();
    ds.base = await resolveDataBase();
    ds.manifest = await loadManifest(ds.base);
    await ds.loadTelemetry();
    const merged: CluePack = { chunk_id: 0, entities: {} };
    for (let i = 0; i < ds.manifest.packs_count; i++) {
      const name = `pack_${String(i).padStart(3, "0")}.json`;
      const res = await fetch(`${ds.base}/chunks/${name}`);
      if (!res.ok) throw new Error(`pack fetch failed: ${name}`);
      const packJson = (await res.json()) as CluePack;
      Object.assign(merged.entities, packJson.entities);
    }
    for (const [id, ent] of Object.entries(merged.entities)) {
      ds.pack.set(Number(id), ent);
    }
    ds.adjacency = buildAdjacency(merged);
    return ds;
  }

  /** Parse the 24-byte binary telemetry store (Blueprint §4 schema). */
  private async loadTelemetry(): Promise<void> {
    try {
      const res = await fetch(`${this.base}/telemetry.bin`);
      if (!res.ok) throw new Error(`bin ${res.status}`);
      const buf = await res.arrayBuffer();
      const view = new DataView(buf);
      const count = Math.floor(buf.byteLength / 24);
      for (let i = 0; i < count; i++) {
        const o = i * 24;
        const lat = view.getFloat32(o + 8, true);
        const lon = view.getFloat32(o + 12, true);
        const rec: TelemetryRecord = {
          id: view.getUint32(o, true),
          year: view.getInt32(o + 4, true),
          lat: Number.isNaN(lat) ? null : lat,
          lon: Number.isNaN(lon) ? null : lon,
          dom: view.getUint8(o + 16),
          subdom: view.getUint8(o + 17),
          notability: view.getUint16(o + 18, true),
          cluster: view.getUint32(o + 20, true),
        };
        this.records.set(rec.id, rec);
      }
      if (this.records.size > 0) return;
    } catch {
      /* fall through to the JSON mirror */
    }
    const res = await fetch(`${this.base}/telemetry.json`);
    if (!res.ok) throw new Error("telemetry load failed");
    const json = (await res.json()) as { records: TelemetryRecord[] };
    for (const rec of json.records) this.records.set(rec.id, rec);
  }

  nameOf(id: number): string {
    return this.pack.get(id)?.name ?? `#${id}`;
  }

  /**
   * Autocomplete search (Blueprint §4): shards are fetched on demand
   * after the first two characters are typed and cached locally.
   */
  async search(query: string): Promise<ShardEntity[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const prefix = shardPrefix(q);
    if (!prefix) return [];
    let shard = this.shardCache.get(prefix);
    if (!shard) {
      try {
        const res = await fetch(`${this.base}/trie_shards/${prefix}.json`);
        if (!res.ok) return [];
        const json = (await res.json()) as TrieShard;
        shard = json.entities;
        this.shardCache.set(prefix, shard);
      } catch {
        return [];
      }
    }
    const hits = shard.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.alt.some((a) => a.toLowerCase().includes(q))
    );
    hits.sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name);
    });
    // de-duplicate by id (an entity can appear under name + alias keys)
    const seen = new Set<number>();
    return hits
      .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .slice(0, 8);
  }
}
