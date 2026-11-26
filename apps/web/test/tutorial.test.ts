/** First visit: the 30-second tutorial auto-starts, plays, and is skippable. */
import { describe, test, expect, beforeAll } from "vitest";
import { mountBody, stubFetch, waitFor, q } from "./helpers";
import type { App } from "../src/app";

let app: App;

beforeAll(async () => {
  mountBody();
  localStorage.clear();
  stubFetch();
  app = (await import("../src/main")).app;
  await waitFor(() => expect(q(".coach")).not.toBeNull());
});

describe("tutorial", () => {
  test("auto-starts on a practice round with a coach card", () => {
    expect(app.run!.mode).toBe("tutorial");
    expect(document.querySelectorAll("#answers .card")).toHaveLength(4);
    expect(q(".coach")!.textContent).toMatch(/VEX-09/);
  });

  test("steps advance and solving moves to the bonus step", async () => {
    q<HTMLButtonElement>('[data-coach="next"]')!.click();
    q<HTMLButtonElement>('[data-coach="next"]')!.click();
    q<HTMLButtonElement>('[data-coach="next"]')!.click();
    expect(q(".coach")!.textContent).toMatch(/Your turn/);
    const r = app.run!.round!;
    q<HTMLButtonElement>(`#answers .card[data-id="${r.subject.id}"]`)!.click();
    await waitFor(() => expect(q(".coach")!.textContent).toMatch(/Bonus|That's it/));
  });

  test("skip ends the tutorial, saves the flag and lands on home", () => {
    q<HTMLButtonElement>('[data-coach="skip"]')!.click();
    expect(q(".coach")).toBeNull();
    expect(q(".home")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("nexus-relay:v2:save")!).tutorialDone).toBe(true);
  });
});
