/**
 * Screen flow (UI restructure, Nov 26): with FIELD TRAINING already
 * seen, the app boots into the MAIN MENU — not the console dump.
 * START opens a clean round on the game screen; secondary info lives
 * in tab drawers; PAUSE opens the pause overlay; SETTINGS opens from
 * both the menu and the pause overlay and returns to its opener;
 * QUIT returns home to the menu.
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

const hidden = (id: string): boolean =>
  (document.getElementById(id) as HTMLElement).hidden;
const click = (id: string): void =>
  (document.getElementById(id) as HTMLButtonElement).click();

beforeAll(async () => {
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  const body = html
    .match(/<body>([\s\S]*)<\/body>/)![1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
  document.body.innerHTML = body;
  localStorage.setItem(SEEN_KEY, "1"); // returning Archivist — no auto-tutorial
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

describe("screen flow (menu-first console)", () => {
  test("boots into the main menu with the console behind it", () => {
    expect(hidden("screen-menu")).toBe(false);
    expect(hidden("screen-game")).toBe(true);
    expect(hidden("screen-settings")).toBe(true);
    expect(document.getElementById("tutorial-card")).toBeNull();
    // all five menu options are on the home screen
    for (const id of [
      "menu-start",
      "mode-daily",
      "mode-endless",
      "tutorial-btn",
      "menu-settings",
    ]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  test("SETTINGS opens from the menu and BACK returns to the menu", () => {
    click("menu-settings");
    expect(hidden("screen-settings")).toBe(false);
    expect(hidden("screen-menu")).toBe(true);
    click("settings-back");
    expect(hidden("screen-menu")).toBe(false);
    expect(hidden("screen-settings")).toBe(true);
  });

  test("START opens a round on the clean game screen", () => {
    click("menu-start");
    expect(hidden("screen-game")).toBe(false);
    expect(hidden("screen-menu")).toBe(true);
    expect(document.getElementById("round-label")!.textContent).toContain(
      "FREE SIGNAL"
    );
    const begin = document.getElementById("begin-btn") as HTMLButtonElement;
    expect(begin.disabled).toBe(false);
    begin.click();
    expect(begin.textContent).toContain("ACTIVE");
    // secondary info is tucked into drawers: telemetry is the default
    // tab, vault + manual wait behind their tabs
    expect(hidden("tabpage-telemetry")).toBe(false);
    expect(hidden("tabpage-vault")).toBe(true);
    expect(hidden("tabpage-manual")).toBe(true);
    click("tab-vault");
    expect(hidden("tabpage-vault")).toBe(false);
    expect(hidden("tabpage-telemetry")).toBe(true);
    click("tab-manual");
    expect(hidden("tabpage-manual")).toBe(false);
    click("tab-telemetry");
    expect(hidden("tabpage-telemetry")).toBe(false);
  });

  test("PAUSE overlay: SETTINGS from pause returns to the paused game; RESUME and QUIT behave", () => {
    click("pause-btn");
    expect(hidden("pause-overlay")).toBe(false);
    click("pause-settings-btn");
    expect(hidden("screen-settings")).toBe(false);
    expect(hidden("screen-game")).toBe(true);
    click("settings-back");
    expect(hidden("screen-game")).toBe(false);
    expect(hidden("pause-overlay")).toBe(false); // still paused underneath
    click("resume-btn");
    expect(hidden("pause-overlay")).toBe(true);
    click("pause-btn");
    expect(hidden("pause-overlay")).toBe(false);
    click("quit-btn");
    expect(hidden("pause-overlay")).toBe(true);
    expect(hidden("screen-menu")).toBe(false);
    expect(hidden("screen-game")).toBe(true);
  });

  test("DAILY from the menu opens today's signal; topbar MENU returns home", () => {
    click("mode-daily");
    expect(hidden("screen-game")).toBe(false);
    expect(document.getElementById("round-label")!.textContent).toContain(
      "DAILY"
    );
    click("menu-btn");
    expect(hidden("screen-menu")).toBe(false);
    expect(hidden("screen-game")).toBe(true);
  });
});
