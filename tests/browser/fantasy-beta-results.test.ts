import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { evidenceRoot } from "./evidence";

let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture(
    "tests/fixtures/fantasy-beta-results.tsx",
  );
  await mkdir(evidenceRoot, { recursive: true });
});
for (const width of [320, 412, 1366])
  test(`Beta standings and rewards preserve server totals and tied ranks at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/beta-results-fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><title>Isolated beta standings fixture</title></head><body class="fantasy-mode"><main id="fixture-root" class="app-content"></main></body></html>',
        });
      if (url.pathname.startsWith("/api/")) {
        errors.push(`Unexpected API ${url.pathname}`);
        return route.abort();
      }
      const root = path.resolve("public"),
        file = path.resolve(root, `.${url.pathname}`);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        return route.fulfill({
          body: await readFile(file),
          contentType: file.endsWith(".png")
            ? "image/png"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "font/woff2",
        });
      } catch {
        return route.abort();
      }
    });
    await page.goto("https://beta.example.invalid/beta-results-fixture");
    for (const css of [
      "brand-theme.css",
      "globals.css",
      "community-app.css",
      "mobile-app.css",
      "fantasy.css",
    ])
      await page.addStyleTag({ path: path.resolve("src/app", css) });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => Reflect.get(window, "renderBetaResults")("play"));
    const standings = page
      .getByRole("heading", { name: "Beta championship standings" })
      .locator("..");
    await expect(standings.locator(".fantasy-row")).toHaveText([
      "1. You250 pts",
      "1. Invited member250 pts",
      "2. Another member100 pts",
    ]);
    await expect(
      page.getByText("Current release only", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth + 1
          ? []
          : [...document.querySelectorAll("body *")]
              .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
              .map((el) => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent?.slice(0, 50),
                right: el.getBoundingClientRect().right,
              })),
      ),
    ).toEqual([]);
    await page.screenshot({
      path: path.join(evidenceRoot, `ISOLATED-beta-standings-${width}.png`),
      fullPage: true,
    });
    await page.evaluate(() =>
      Reflect.get(window, "renderBetaResults")("cards"),
    );
    await expect(
      page.getByText(
        "Beta gameplay points. These are kept separate from official launch rankings.",
      ),
    ).toBeVisible();
    await page.locator("summary").filter({ hasText: "Reward history" }).click();
    await expect(
      page.getByText("2026-10-09 · beta", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(evidenceRoot, `ISOLATED-beta-rewards-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
