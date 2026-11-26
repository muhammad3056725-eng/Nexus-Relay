/**
 * End-to-end smoke test: boots the real app in jsdom with the real
 * starter dataset served from disk, then plays a full round —
 * begin, tune a relay, ping a miss, ping the target, bridge a link,
 * and check the Signal Integrity report + share card render.
 */
import { describe, test, expect, vi, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const dataRoot = join(repoRoot, "public", "data", "v1");

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
    phase: number;
    solved: boolean;
    bridges: number[];
    overclockBeams(): Array<{ rel: string; targetId: number }>;
  } | null;
  ds: { nameOf(id: number): string };
  begin(): void;
  onPing(): Promise<void>;
  onBridge(): Promise<void>;
  finish(): void;
}

let game: GameInternals;

beforeAll(async () => {
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  const body = html
    .match(/<body>([\s\S]*)<\/body>/)![1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
  document.body.innerHTML = body;
  stubFetch();
  const mod = await import("../src/main");
  game = mod.game as unknown as GameInternals;
  await vi.waitFor(
    () => {
      expect(document.getElementById("dataset-line")!.textContent).toContain(
        "ENTITIES"
      );
    },
    { timeout: 5000 }
  );
});

describe("NEXUS RELAY web app (jsdom, real starter dataset)", () => {
  test("boots and loads the dataset", () => {
    expect(
      document.getElementById("dataset-line")!.textContent
    ).toContain("1021 ENTITIES");
    expect(game.round).not.toBeNull();
  });

  test("plays a full round to the results report", async () => {
    game.begin();
    const round = game.round!;
    const targetName = game.ds.nameOf(round.targetId);

    // Tune a relay (spends a probe, decrypts a clue)
    const tuneBtn = document.querySelector<HTMLButtonElement>(
      ".relay-card .px-btn"
    )!;
    expect(tuneBtn.disabled).toBe(false);
    tuneBtn.click();
    expect(
      document.querySelector(".relay-clue.unlocked")!.textContent!.length
    ).toBeGreaterThan(10);

    // Ping a wrong entity first
    const input = document.getElementById(
      "hypothesis-input"
    ) as HTMLInputElement;
    const other = targetName === "Chess" ? "Pizza" : "Chess";
    input.value = other;
    await game.onPing();
    expect(document.querySelectorAll(".ping-row").length).toBe(1);
    expect(round.solved).toBe(false);

    // Ping the target -> Overclock phase
    input.value = targetName;
    await game.onPing();
    expect(round.solved).toBe(true);
    expect(round.phase).toBe(3);
    expect(
      (document.getElementById("overclock-box") as HTMLElement).hidden
    ).toBe(false);
    expect(document.querySelectorAll(".beam").length).toBe(3);

    // Bridge one valid connected entity
    const beam = round.overclockBeams()[0];
    const bridgeInput = document.getElementById(
      "bridge-input"
    ) as HTMLInputElement;
    bridgeInput.value = game.ds.nameOf(beam.targetId);
    await game.onBridge();
    expect(round.bridges.length).toBe(1);

    // Finish and verify the report + share card
    game.finish();
    expect(
      (document.getElementById("results-box") as HTMLElement).hidden
    ).toBe(false);
    const share = document.getElementById("share-card")!.textContent!;
    expect(share).toContain("NEXUS RELAY #");
    expect(share).toContain(targetName.toUpperCase());
    expect(share).toContain("Overclock Surge: ⚡");
    expect(document.getElementById("results-body")!.textContent).toContain(
      "TOTAL SIGNAL INTEGRITY"
    );
  });

  test("a lost round teaches: debrief shows the closest pass and the trail", async () => {
    // Fresh free-signal round from the menu, then burn all 10 guesses
    // on wrong entities — the failure report must coach, not punish.
    (document.getElementById("menu-start") as HTMLButtonElement).click();
    game.begin();
    const round = game.round!;
    const internals = game as unknown as {
      ds: { records: Map<number, unknown>; nameOf(id: number): string };
    };
    const wrongIds = [...internals.ds.records.keys()]
      .filter((id) => id !== round.targetId)
      .slice(0, 10);
    const input = document.getElementById(
      "hypothesis-input"
    ) as HTMLInputElement;
    for (const id of wrongIds) {
      input.value = internals.ds.nameOf(id);
      await game.onPing();
    }
    expect(round.solved).toBe(false);
    expect(
      (document.getElementById("results-box") as HTMLElement).hidden
    ).toBe(false);
    const body = document.getElementById("results-body")!.textContent!;
    expect(body).toContain("WHAT THE TELEMETRY POINTED TO");
    expect(body).toContain("Closest pass");
    // every ping row carries the generous heat read-out
    expect(document.querySelectorAll(".ping-row").length).toBe(10);
    expect(document.querySelector(".ping-verdict")!.textContent).toContain(
      "SIGNAL HEAT"
    );
  });
});
