import { expect, type Page } from "@playwright/test";

export const STATS = { total: 12, preserved: 5, lost: 7, preservedPct: 42 };

/**
 * Deterministic network: the model is "unavailable" (authored dialogue only)
 * and run stats are faked so tests never write to the real database.
 */
export async function stubNetwork(page: Page, options: { aiText?: string } = {}): Promise<{ runs: unknown[] }> {
  const runs: unknown[] = [];
  await page.route("**/api/dialogue", (route) =>
    options.aiText
      ? route.fulfill({ status: 200, json: { success: true, data: { text: options.aiText, source: "ai" }, error: null } })
      : route.fulfill({ status: 503, json: { success: false, data: null, error: "unavailable" } }),
  );
  await page.route("**/api/runs", async (route) => {
    if (route.request().method() === "POST") runs.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: { success: true, data: STATS, error: null } });
  });
  return { runs };
}

/** From the landing page to a live terminal, skipping the (already seen) cinematic. */
export async function enterTerminal(page: Page, name = "RAVEN", query = ""): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem("tls:seenOpening", "1"));
  await page.goto(`/${query}`);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("callsign")).toBeAttached();
  await page.getByTestId("callsign").focus();
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Ready, ${name}?`)).toBeAttached();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cinematic")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("boot")).toContainText("PRESS ANY KEY", { timeout: 20_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("terminal")).toBeVisible();
  await expect(page.getByTestId("output")).toContainText("Type help");
}

export async function run(page: Page, command: string, expectText?: string | RegExp): Promise<void> {
  await page.getByTestId("command-input").focus();
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  if (expectText) await expect(page.getByTestId("output")).toContainText(expectText);
}
