/**
 * FIELD TRAINING tutorial: boots the real app in jsdom with an empty
 * localStorage (a true first visit) and verifies the coach card
 * auto-shows over a practice round, teaches the CASUAL loop (type
 * banner, ten guesses, free clue, plain-language feedback, free
 * hints, DETAILS), action steps advance on REAL game actions, SKIP
 * persists the seen flag and restores a live round, and the FIELD
 * TRAINING button re-opens the tutorial.
 */
import { describe, test, expect, vi, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
  round: { targetId: number } | null;
  ds: {
    pack: Map<number, { edges?: Array<{ target_id: number }> }>;
    nameOf(id: number): string;
  };
  onPing(): Promise<void>;
}

let game: GameInternals;

beforeAll(async () => {
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  const body = html
    .match(/<body>([\s\S]*)<\/body>/)![1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
  document.body.innerHTML = body;
  localStorage.clear(); // a true first visit
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

describe("FIELD TRAINING tutorial (first visit)", () => {
  test("auto-shows over a practice round on first visit", () => {
    expect(document.getElementById("tutorial-card")).not.toBeNull();
    expect(document.getElementById("tut-title")!.textContent).toContain(
      "MYSTERY GUEST"
    );
    // the casual surface is live underneath: the TYPE is already shown
    expect(document.getElementById("type-label")!.textContent!.length)
      .toBeGreaterThan(2);
    expect(document.getElementById("round-label")!.textContent).toContain(
      "PRACTICE ROUND"
    );
    // the tutorial plays on the game screen, in front of the menu
    expect(
      (document.getElementById("screen-game") as HTMLElement).hidden
    ).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  test("info steps advance with NEXT; the guess step waits for a real GUESS", async () => {
    const next = document.getElementById("tut-next") as HTMLButtonElement;
    next.click(); // guest -> guesses
    expect(document.getElementById("tut-title")!.textContent).toContain(
      "TEN GUESSES"
    );
    next.click(); // guesses -> free clue
    expect(document.getElementById("tut-title")!.textContent).toContain(
      "FREE CLUE"
    );
    next.click(); // clue -> guess (action step)
    expect(document.getElementById("tut-title")!.textContent).toContain(
      "MAKE A GUESS"
    );
    expect(
      (document.getElementById("tut-next") as HTMLButtonElement).hidden
    ).toBe(true);

    // a REAL guess at the practice target's neighbour advances the step
    const targetId = game.round!.targetId;
    const neighbourId = game.ds.pack.get(targetId)!.edges![0].target_id;
    const input = document.getElementById(
      "hypothesis-input"
    ) as HTMLInputElement;
    input.value = game.ds.nameOf(neighbourId);
    await game.onPing();
    await vi.waitFor(
      () => {
        expect(document.getElementById("tut-title")!.textContent).toContain(
          "WARMER OR COLDER"
        );
      },
      { timeout: 3000 }
    );
    // and the guess produced a friendly feed card, not an instrument row
    expect(document.querySelector(".guess-card")).not.toBeNull();
  });

  test("SKIP closes the tutorial, persists the flag, restores a live round", () => {
    (document.getElementById("tut-skip") as HTMLButtonElement).click();
    expect(document.getElementById("tutorial-card")).toBeNull();
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    expect(document.getElementById("round-label")!.textContent).not.toContain(
      "PRACTICE ROUND"
    );
    // exiting training lands back home on the main menu
    expect(
      (document.getElementById("screen-menu") as HTMLElement).hidden
    ).toBe(false);
  });

  test("FIELD TRAINING button re-opens the tutorial anytime", () => {
    (document.getElementById("tutorial-btn") as HTMLButtonElement).click();
    expect(document.getElementById("tutorial-card")).not.toBeNull();
    expect(document.getElementById("round-label")!.textContent).toContain(
      "PRACTICE ROUND"
    );
    (document.getElementById("tut-skip") as HTMLButtonElement).click();
    expect(document.getElementById("tutorial-card")).toBeNull();
  });
});
