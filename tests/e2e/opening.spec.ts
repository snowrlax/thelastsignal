import { expect, test, type Page } from "@playwright/test";
import { run, stubNetwork } from "./helpers";

const progress = async (page: Page): Promise<number> => Number(await page.getByTestId("cinematic").getAttribute("data-progress"));

test("a first-time run: the opening types itself out, then title to ending with no page errors", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/Failed to load resource.*503/.test(message.text())) return; // the stubbed model outage
    errors.push(`console: ${message.text()}`);
  });
  await stubNetwork(page);

  await page.goto("/");
  await page.getByTestId("play").click();
  await page.getByTestId("callsign").focus();
  await page.keyboard.type("RAVEN");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Ready, RAVEN?")).toBeAttached();
  await page.keyboard.press("Enter");

  const cinematic = page.getByTestId("cinematic");
  await expect(cinematic).toHaveAttribute("data-state", "typing");
  await expect.poll(() => progress(page)).toBeGreaterThan(0);
  const early = await progress(page);
  await expect.poll(() => progress(page)).toBeGreaterThan(early);
  await expect(cinematic).toHaveAttribute("data-state", "holding");
  await expect(cinematic).toHaveAttribute("data-card", "1", { timeout: 10_000 });

  await expect(cinematic).toHaveAttribute("data-state", "prompt", { timeout: 60_000 });
  await expect(cinematic).toContainText("PRESS ANY KEY TO CONTINUE");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("boot")).toContainText("PRESS ANY KEY", { timeout: 20_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("output")).toContainText("Type help");

  await run(page, "help", "ls");
  await run(page, "cat README.txt", "OFRENDA");
  await run(page, "top", "persona-recon");
  await run(page, "kill -9 218", "hollowd  KILLED");
  await expect(page.getByTestId("ending")).toHaveAttribute("data-ending", "lost", { timeout: 90_000 });
  await page.getByTestId("restart").click();
  await expect(page.getByTestId("boot")).toBeVisible();
  expect(errors).toEqual([]);
});
