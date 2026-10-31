import { expect, test } from "@playwright/test";
import { enterTerminal, run, STATS, stubNetwork } from "./helpers";

test.describe("first visit", () => {
  test("the landing page shows the CRT, the title and one obvious action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /THE LAST\s*SIGNAL/ })).toBeVisible();
    await expect(page.getByText("A short interactive psychological horror experience")).toBeVisible();
    await expect(page.getByTestId("play")).toBeVisible();
    await expect(page.getByRole("button", { name: /sound/i }).first()).toBeVisible();
  });

  test("identification rejects an empty callsign and offers reduced pressure", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("play").click();
    await expect(page.getByTestId("callsign")).toBeAttached();
    await page.getByTestId("callsign").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("A NAME OR CALLSIGN IS REQUIRED.")).toBeVisible();
    await page.getByTestId("pressure").click();
    await expect(page.getByTestId("pressure")).toContainText("Reduced 1.5×");
    await page.getByTestId("callsign").focus();
    await page.keyboard.type("  Nightjar  ");
    await page.getByTestId("continue").click();
    await expect(page.getByText("Ready, Nightjar?")).toBeAttached();
  });

  test("the first viewing of the opening cannot be skipped", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("play").click();
    await page.getByTestId("callsign").focus();
    await page.keyboard.type("RAVEN");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("cinematic")).toBeVisible();
    await expect(page.getByText("NOVEMBER 2.")).toBeAttached();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("cinematic")).toBeVisible();
    await expect(page.getByText("SPACE · NEXT")).toHaveCount(0);
  });
});

test.describe("the terminal", () => {
  test("teaches itself: help, mistakes, completion, history and the manual", async ({ page }) => {
    await stubNetwork(page);
    await enterTerminal(page);
    await run(page, "help", "OFRENDA SHELL · available commands");
    await run(page, "lss", "did you mean 'ls'");
    await page.getByTestId("command-input").focus();
    await page.keyboard.type("cat REA");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("output")).toContainText("THE CONTAINMENT SERVICE MUST STAY ACTIVE");
    await page.keyboard.press("ArrowUp");
    await expect(page.getByTestId("prompt")).toContainText("cat README.txt");
    await page.keyboard.press("Escape");
    await page.keyboard.press("F1");
    await expect(page.getByTestId("manual")).toBeVisible();
    await expect(page.getByTestId("status-bar")).toContainText("MANUAL OPEN");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("manual")).toHaveCount(0);
  });

  test("characters speak through message windows, with authored fallbacks", async ({ page }) => {
    await stubNetwork(page);
    await enterTerminal(page);
    await expect(page.getByTestId("msg-vega").first()).toContainText(/2026/, { timeout: 20_000 });
    await expect(page.getByTestId("timer")).toContainText("CONTAINMENT WINDOW");
  });

  test("model lines are shown when the model answers", async ({ page }) => {
    await stubNetwork(page, { aiText: "Is it really 2026? Tell me it isn't." });
    await enterTerminal(page);
    await expect(page.getByTestId("msg-vega").first()).toContainText("Is it really 2026? Tell me it isn't.", { timeout: 20_000 });
  });
});

test.describe("endings", () => {
  test("ENDING A: back up the archive, stop the persona gracefully, keep HOLLOW", async ({ page }) => {
    const { runs } = await stubNetwork(page);
    await enterTerminal(page);
    await run(page, "cat README.txt", "THE CONTAINMENT SERVICE MUST STAY ACTIVE");
    await run(page, "cat /research/reconstruction_notes.txt", "it isn't. I am the one writing this.");
    await run(page, "cat /archive/vega/session_014.log", "confabulation rate");
    await run(page, "ps aux", "hollowd --mode=containment");
    await run(page, "ps -fp 218", "containment supervisor");
    await run(page, "cp -r /archive/vega /recovery/vega_archive", "write lock held by pid 404");
    await run(page, "cat /restricted/containment_protocol.txt", "Not for anyone. Not for me.");
    await run(page, "cat /restricted/identity_validation.log", "It is not Dr. Ines Vega.");
    await expect(page.getByTestId("status-bar")).toContainText("PHASE 3/3");
    await run(page, "kill -TERM 404", "the original archive has not been secured");
    await run(page, "cp -r /archive/vega /recovery/vega_archive", "RECOVERY COPY VERIFIED");
    await run(page, "kill -TERM 404", "persona-recon[404]: exited (0)");
    await expect(page.getByTestId("output")).toContainText("OFRENDA SYSTEM: SAFE SHUTDOWN", { timeout: 60_000 });
    await expect(page.getByTestId("epitaph")).toBeVisible({ timeout: 30_000 });
    const ending = page.getByTestId("ending");
    await expect(ending).toHaveAttribute("data-ending", "preserved", { timeout: 30_000 });
    await expect(ending).toContainText("ARCHIVE PRESERVED");
    await expect(page.getByTestId("global-stats")).toContainText(`${STATS.total} operators`);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ ending: "preserved", cause: null, phaseReached: "recovery" });
    const download = page.waitForEvent("download");
    await page.getByTestId("report").click();
    expect((await download).suggestedFilename()).toBe("ofrenda-session-raven.txt");
  });

  test("ENDING B: kill -9 218 hands the machine to the reconstruction", async ({ page }) => {
    const { runs } = await stubNetwork(page);
    await enterTerminal(page);
    await run(page, "ps aux", "persona-recon");
    await run(page, "kill -TERM 218", "REFUSED");
    await run(page, "kill -9 218", "hollowd  KILLED");
    await expect(page.getByTestId("status-bar")).toContainText("CONTROL LOST");
    await expect(page.getByTestId("output")).toContainText("Thank you, RAVEN.", { timeout: 40_000 });
    const ending = page.getByTestId("ending");
    await expect(ending).toHaveAttribute("data-ending", "lost", { timeout: 30_000 });
    await expect(ending).toContainText("SIGNAL LOST");
    await expect(ending).toContainText("force-killed the containment service");
    expect(runs[0]).toMatchObject({ ending: "lost", cause: "hollow_killed" });
    await page.getByTestId("restart").click();
    await expect(page.getByTestId("boot")).toBeVisible();
  });

  test("ENDING B: hesitation lets the containment window close", async ({ page }) => {
    await stubNetwork(page);
    await enterTerminal(page, "RAVEN", "?timescale=40");
    await expect(page.getByTestId("timer")).toContainText("FINAL GRACE", { timeout: 30_000 });
    const ending = page.getByTestId("ending");
    await expect(ending).toHaveAttribute("data-ending", "lost", { timeout: 60_000 });
    await expect(ending).toContainText("window closed");
    await page.getByTestId("title").click();
    await expect(page.getByTestId("play")).toBeVisible();
  });
});
