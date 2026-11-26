/**
 * FIELD TRAINING tutorial: boots the real app in jsdom with an empty
 * localStorage (a true first visit) and verifies the coach card
 * auto-shows over a practice round, action steps advance on REAL
 * console actions, SKIP persists the seen flag and restores a live
 * round, and the FIELD TRAINING button re-opens the tutorial.
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

beforeAll(async () => {
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  const body = html
    .match(/<body>([\s\S]*)<\/body>/)![1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
  document.body.innerHTML = body;
  localStorage.clear(); // a true first visit
  stubFetch();
  await import("../src/main");
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
      "SEALED ENTITY"
    );
    expect(document.getElementById("round-label")!.textContent).toContain(
      "PRACTICE ROUND"
    );
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  test("info steps advance with NEXT; the tune step waits for a real TUNE", async () => {
    const next = document.getElementById("tut-next") as HTMLButtonElement;
    next.click(); // sealed -> probes
    expect(document.getElementById("tut-title")!.textContent).toContain(
      "SIX PROBES"
    );
    next.click(); // probes -> tune (action step)
    expect(document.getElementById("tut-title")!.textContent).toContain(
      "TUNE-A-RELAY"
    );
    expect(
      (document.getElementById("tut-next") as HTMLButtonElement).hidden
    ).toBe(true);

    const tuneBtn = document.querySelector<HTMLButtonElement>(
      ".relay-card .px-btn"
    )!;
    expect(tuneBtn.disabled).toBe(false);
    tuneBtn.click();
    await vi.waitFor(
      () => {
        expect(document.getElementById("tut-title")!.textContent).toContain(
          "PING-A-HYPOTHESIS"
        );
      },
      { timeout: 3000 }
    );
  });

  test("SKIP closes the tutorial, persists the flag, restores a live round", () => {
    (document.getElementById("tut-skip") as HTMLButtonElement).click();
    expect(document.getElementById("tutorial-card")).toBeNull();
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    expect(document.getElementById("round-label")!.textContent).not.toContain(
      "PRACTICE ROUND"
    );
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
