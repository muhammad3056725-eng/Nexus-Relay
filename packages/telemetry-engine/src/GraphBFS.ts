/**
 * NEXUS RELAY — GraphBFS (Blueprint §2: hop distance on the knowledge
 * graph; §5 Stage 4: graph is bidirectional for traversal).
 */
import type { CluePack } from "@nexus-relay/shared-types";

export type Adjacency = Map<number, Set<number>>;

/** Build bidirectional adjacency from a clue pack's edge lists. */
export function buildAdjacency(pack: CluePack): Adjacency {
  const adj: Adjacency = new Map();
  const ensure = (id: number): Set<number> => {
    let set = adj.get(id);
    if (!set) {
      set = new Set();
      adj.set(id, set);
    }
    return set;
  };
  for (const [idStr, ent] of Object.entries(pack.entities)) {
    const id = Number(idStr);
    ensure(id);
    for (const edge of ent.edges || []) {
      ensure(id).add(edge.target_id);
      ensure(edge.target_id).add(id);
    }
  }
  return adj;
}

export interface HopResult {
  hops: number | null;
  via: number | null;
}

/**
 * Shortest-path hop distance between two nodes.
 * Returns { hops, via } where via is the first bridge node on a shortest
 * path (the node named in "2 Hops via [X]"), or null when unreachable.
 */
export function hopDistance(adj: Adjacency, from: number, to: number): HopResult {
  if (from === to) return { hops: 0, via: null };
  const prev = new Map<number, number | null>([[from, null]]);
  const queue: number[] = [from];
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adj.get(u) ?? []) {
      if (prev.has(v)) continue;
      prev.set(v, u);
      if (v === to) {
        const path: number[] = [];
        let cur: number | null = to;
        while (cur !== null) {
          path.unshift(cur);
          cur = prev.get(cur) ?? null;
        }
        return { hops: path.length - 1, via: path.length > 2 ? path[1] : null };
      }
      queue.push(v);
    }
  }
  return { hops: null, via: null };
}
