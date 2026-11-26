/**
 * End-to-end in jsdom (returning player): boots the real app against
 * the real dataset files, plays Quick Play rounds with the keyboard,
 * checks the bonus link, settings persistence and the summary.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { mountBody, stubFetch, waitFor, q } from "./helpers";
import type { App } from "../src/app";

let app: App;

beforeAll(async () => {
  mountBody();
  localStorage.setItem("nexus-relay:v2:save", JSON.stringify({ tutorialDone: true }));
  stubFetch();
  app = (await import("../src/main")).app;
  await waitFor(() => expect(q(".home")).not.toBeNull());
});

const key = (k: string) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("NEXUS RELAY app", () => {
  test("home shows the four modes and the archive count", () => {
    for (const act of ["daily", "quick", "channels", "endless"]) {
      expect(q(`[data-act="${act}"]`), act).not.toBeNull();
    }
    expect(q('[data-act="archive"]')!.textContent).toMatch(/0\/\d{3}/);
    expect(document.body.textContent).not.toMatch(/telemetry|probe|relay deck/i);
  });

  test("Quick Play: clue + 4 cards; a wrong pick reveals clue 2; the right card scores", async () => {
    q<HTMLButtonElement>('[data-act="quick"]')!.click();
    await waitFor(() => expect(document.querySelectorAll("#answers .card")).toHaveLength(4));
    const r = app.run!.round!;
    expect(q("#clues")!.textContent).toContain(r.subject.clues[0]);
    expect(q("#clues")!.getAttribute("aria-live")).toBe("polite");
    const wrongIdx = r.options.findIndex((id) => id !== r.subject.id);
    key(String(wrongIdx + 1));
    expect(r.clue).toBe(2);
    expect(document.querySelectorAll("#answers .card.wrong")).toHaveLength(1);
    expect(q("#clues")!.textContent).toContain(r.subject.clues[1]);
    const rightIdx = r.options.indexOf(r.subject.id);
    key(String(rightIdx + 1));
    expect(r.phase).toBe("solved");
    expect(app.run!.score).toBeGreaterThanOrEqual(400);
    await waitFor(() => expect(q("#result")!.hidden).toBe(false));
  });

  test("bonus link answers, then the next round starts", async () => {
    const r = app.run!.round!;
    if (r.link) {
      const before = app.run!.score;
      key(String(r.link.options.indexOf(r.link.correct) + 1));
      expect(app.run!.score).toBe(before + 100);
    }
    q<HTMLButtonElement>("#continue")!.click();
    await waitFor(() => expect(app.run!.roundNo).toBe(2));
    expect(q("#round-no")!.textContent).toContain("2 / 10");
  });

  test("finishing 10 rounds shows the summary and saves to the archive", async () => {
    for (let guard = 0; guard < 12 && app.screen === "game"; guard++) {
      const r = app.run!.round!;
      if (r.phase === "guessing") key(String(r.options.indexOf(r.subject.id) + 1));
      await waitFor(() => expect(q("#result")!.hidden).toBe(false));
      if (r.link && r.linkAnswer == null) key("1");
      q<HTMLButtonElement>("#continue")!.click();
      await waitFor(() => expect(app.screen === "summary" || app.run!.round !== r).toBe(true));
    }
    expect(app.screen).toBe("summary");
    expect(q(".big-score")).not.toBeNull();
    const saved = JSON.parse(localStorage.getItem("nexus-relay:v2:save")!);
    expect(Object.keys(saved.archive).length).toBe(10);
    expect(saved.stats.runs).toBe(1);
  });

  test("settings persist (music off by default)", () => {
    q<HTMLButtonElement>('[data-act="home"]')!.click();
    q<HTMLButtonElement>('[data-act="settings"]')!.click();
    const music = q<HTMLInputElement>('[data-set="music"]')!;
    expect(music.checked).toBe(false);
    const turbo = q<HTMLInputElement>('[data-set="turbo"]')!;
    turbo.checked = true;
    turbo.dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(localStorage.getItem("nexus-relay:v2:save")!).settings.turbo).toBe(true);
  });

  test("channels list every category", () => {
    q<HTMLButtonElement>('[data-act="home"]')!.click();
    q<HTMLButtonElement>('[data-act="channels"]')!.click();
    expect(document.querySelectorAll('[data-act="channel"]').length).toBeGreaterThanOrEqual(12);
  });
});
