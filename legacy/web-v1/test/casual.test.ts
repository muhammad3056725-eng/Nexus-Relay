/**
 * CASUAL SURFACE (owner rebuild, Nov 26): boots the real app in jsdom
 * with FIELD TRAINING already seen, then plays the casual loop —
 * the guest's TYPE is always shown, a free starting clue is waiting,
 * guesses answer in plain language (warmer/colder · newer/older ·
 * same field), HINT is free and never punishes, the deep telemetry
 * hides behind DETAILS, and the round runs on 10 guesses.
 */
import { describe, test, expect, vi, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Round } from "@nexus-relay/telemetry-engine";
import type {
  PackEntity,
  TelemetryRecord,
} from "@nexus-relay/shared-types";
import { heatPercent } from "../src/components/TelemetryPanel";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const dataRoot = join(repoRoot, "public", "data", "v1");
const SEEN_KEY = "nexus-relay:tutorial-seen";

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    async (url: string) => {
      const marker = "/data/v1/";
      const idx = String(url).indexOf(marker);
      if (idx === -1) return { ok: false, status: 404 };
      const rel = String(url).slice(idx + marker.length);
      const path = join(dataRoot, rel);
      if (!existsSync(path)) return { ok: false, status: 404 };
      const buf = readFileSync(path);
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(buf.toString("utf8")),
        arrayBuffer: async () =>
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
    }
  );
}

interface GameInternals {
  round: {
    targetId: number;
    probes: number;
    solved: boolean;
    tuned: Set<string>;
  } | null;
  ds: {
    records: Map<number, TelemetryRecord>;
    pack: Map<number, PackEntity>;
    adjacency: unknown;
    nameOf(id: number): string;
  };
  onPing(): Promise<void>;
}

let game: GameInternals;

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const click = (id: string): void => $(id).click();

/** The coldest possible guess against the current target, by the
 *  same heat composite the game displays — found on scratch rounds. */
function coldestGuessId(targetId: number): { id: number; heat: number } {
  let best = { id: -1, heat: Number.POSITIVE_INFINITY };
  for (const id of game.ds.records.keys()) {
    if (id === targetId) continue;
    const scratch = new Round({
      targetId,
      records: game.ds.records,
      pack: game.ds.pack,
      adjacency: game.ds.adjacency as never,
    });
    const heat = heatPercent(scratch.ping(id));
    if (heat < best.heat) best = { id, heat };
  }
  return best;
}

beforeAll(async () => {
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  const body = html
    .match(/<body>([\s\S]*)<\/body>/)![1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
  document.body.innerHTML = body;
  localStorage.setItem(SEEN_KEY, "1"); // returning player — no auto-tutorial
  stubFetch();
  const mod = await import("../src/main");
  game = mod.game as unknown as GameInternals;
  await vi.waitFor(
    () => {
      expect($("dataset-line").textContent).toContain("ENTITIES");
    },
    { timeout: 5000 }
  );
});

describe("casual surface (menu → clean round)", () => {
  test("START shows the guest's TYPE, a free starting clue, and 10 guesses", () => {
    click("menu-start");
    expect($("screen-game").hidden).toBe(false);
    // TYPE always shown — derived from the target's designation
    const type = $("type-label").textContent!.trim();
    expect(type.length).toBeGreaterThan(2);
    expect(type).toMatch(/^(a|an|the)\s/i);
    // free starting clue already revealed
    expect($("start-clue").textContent).toContain("STARTING CLUE");
    expect($("start-clue").textContent!.length).toBeGreaterThan(30);
    // the casual economy: 10 guesses on the rail
    expect(game.round!.probes).toBe(10);
    expect($("guess-pips").textContent).toContain("🗲");
  });

  test("DETAILS is hidden by default and opens on tap", () => {
    expect($("details-body").hidden).toBe(true);
    click("details-btn");
    expect($("details-body").hidden).toBe(false);
    click("details-btn");
    expect($("details-body").hidden).toBe(true);
  });

  test("HINT is free: reveals clues, spends no guess, never dents the score", () => {
    const before = game.round!.probes;
    click("hint-btn");
    expect(document.querySelectorAll("#hint-list .clue-line").length).toBe(1);
    click("hint-btn");
    expect(document.querySelectorAll("#hint-list .clue-line").length).toBe(2);
    expect(game.round!.probes).toBe(before);
    // hints never touch the engine's tuned set (the multiplier input)
    expect(game.round!.tuned.size).toBe(0);
    expect($("hint-btn").textContent).toContain("FREE");
  });

  test("a guess answers in plain language — heat, era, field chips", async () => {
    click("begin-btn");
    const cold = coldestGuessId(game.round!.targetId);
    expect(cold.heat).toBeLessThan(85);
    const input = $<HTMLInputElement>("hypothesis-input");
    input.value = game.ds.nameOf(cold.id);
    await game.onPing();
    const card = document.querySelector(".guess-card");
    expect(card).not.toBeNull();
    const text = card!.textContent!;
    expect(text).toMatch(/🔥|❄️|🌡️/); // heat read
    expect(text).toMatch(/⬆️|⬇️|📅/); // era direction
    expect(text).toMatch(/✅|🧭|❌/); // field match
    expect(text).toContain(game.ds.nameOf(cold.id));
    expect(game.round!.probes).toBe(9);
  });

  test("a closer second guess reads WARMER than the cold first one", async () => {
    const targetId = game.round!.targetId;
    const neighbourId = game.ds.pack.get(targetId)!.edges[0].target_id;
    const input = $<HTMLInputElement>("hypothesis-input");
    input.value = game.ds.nameOf(neighbourId);
    await game.onPing();
    const newest = document.querySelector(".guess-card")!;
    expect(newest.textContent).toContain("Warmer");
    expect(game.round!.probes).toBe(8);
  });

  test("ten wrong guesses end the round — kindly, with the answer", async () => {
    click("menu-btn"); // quit to menu
    expect($("screen-menu").hidden).toBe(false);
    click("menu-start"); // fresh free round
    click("begin-btn");
    const targetId = game.round!.targetId;
    const wrongIds = [...game.ds.records.keys()]
      .filter((id) => id !== targetId)
      .slice(0, 10);
    const input = $<HTMLInputElement>("hypothesis-input");
    for (const id of wrongIds) {
      input.value = game.ds.nameOf(id);
      await game.onPing();
    }
    expect(game.round!.probes).toBe(0);
    expect(game.round!.solved).toBe(false);
    expect($("results-box").hidden).toBe(false);
    expect(document.querySelectorAll(".guess-card").length).toBe(10);
    expect($("results-body").textContent).toContain("Out of guesses");
  });
});
