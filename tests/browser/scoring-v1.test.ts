import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/scoring-review.tsx");
});
for (const width of [320, 390, 1366])
  test(`three-sport saved scoring review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 915 });
    await page.route("**/*", (route) =>
      new URL(route.request().url()).pathname === "/scoring-fixture"
        ? route.fulfill({
            contentType: "text/html",
            body: '<!doctype html><html lang="en"><head><title>Docked scoring fixture</title></head><body><main id="fixture-root"></main></body></html>',
          })
        : route.abort(),
    );
    await page.goto("/scoring-fixture");
    await page.addStyleTag({
      content: ["brand-theme.css", "globals.css", "fantasy.css", "scoring.css"]
        .map((f) => readFileSync("src/app/" + f, "utf8"))
        .join("\n"),
    });
    await page.addScriptTag({ content: bundle });
    await expect(
      page.getByRole("heading", { name: "Every point, explained." }),
    ).toBeVisible();
    for (const sport of ["epl", "nfl", "afl"]) {
      await page
        .getByRole("combobox", { name: "Sport", exact: true })
        .selectOption(sport);
      await page
        .getByRole("combobox", { name: "Recorded stage", exact: true })
        .selectOption("initial");
      await expect(page.locator(".scoring-team h3").first()).toHaveText(
        "Synthetic team Amber",
      );
      await page
        .getByRole("combobox", { name: "Recorded stage", exact: true })
        .selectOption("corrected");
      await expect(page.locator(".scoring-team h3").first()).toHaveText(
        "Synthetic team Violet",
      );
      await page.locator(".scoring-team summary").first().click();
      await expect(page.locator(".scoring-team table").first()).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      mkdirSync("docs/qa/scoring-v1", { recursive: true });
      await page.screenshot({
        path: `docs/qa/scoring-v1/${sport}-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("combobox", { name: "Recorded stage", exact: true })
        .selectOption("pending");
      await expect(page.locator(".scoring-total").first()).toHaveText(
        "Pending data",
      );
      await page
        .getByRole("combobox", { name: "Recorded stage", exact: true })
        .selectOption("final");
      await expect(page.getByRole("status")).toContainText(
        "Final · synthetic scenario",
      );
    }
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(
      violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });
