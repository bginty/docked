import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { evidenceRoot } from "./evidence";
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/phase5-demo.tsx");
  await mkdir(path.join(evidenceRoot, "phase5"), { recursive: true });
});
async function fixture(page: Page, view: string, width: number) {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        ok: false,
        message: "DEMO: Candidate no longer qualifies. No change recorded.",
      },
    }),
  );
  await page.goto("/offline.html");
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>DEMO Phase 5</title><meta name="robots" content="noindex,nofollow"></head><body><main id="demo-root"></main></body></html>',
  );
  for (const file of [
    "brand-theme.css",
    "globals.css",
    "sports-visuals.css",
    "sports-experience.css",
    "community-app.css",
    "native.css",
    "mobile-app.css",
    "beta-experience.css",
    "phase5-edges.css",
  ])
    await page.addStyleTag({ path: path.resolve("src/app", file) });
  await page.addStyleTag({
    content:
      ".demo-label{margin:0;padding:6px 12px;background:var(--brand-navy);color:var(--brand-white);font-size:10px}",
  });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(
    (view) =>
      (
        window as unknown as { renderPhase5Fixture: (view: string) => void }
      ).renderPhase5Fixture(view),
    view,
  );
  await expect(page.locator(".community-shell")).toBeVisible();
  return errors;
}
for (const width of [360, 412, 1366])
  test(`Phase 5 DEMO honest empty and populated discovery at ${width}px`, async ({
    page,
  }) => {
    const errors = await fixture(page, "empty", width);
    await expect(
      page.getByText("No eligible trending Edges yet."),
    ).toBeVisible();
    await expect(
      page.getByText("NO EDGE OF THE WEEK YET", { exact: true }),
    ).toBeVisible();
    if (width <= 760) {
      const card = await page.locator(".pinned-empty--compact").boundingBox();
      const trending = await page.getByRole("heading", { name: "Trending Community Edges" }).boundingBox();
      expect(card!.height).toBeLessThan(180);
      expect(trending!.y).toBeLessThan(650);
      expect(await page.locator(".pinned-docked h2").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(22);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(evidenceRoot, "phase5", `DEMO-empty-${width}.png`),
      fullPage: true,
    });
    await page.evaluate(() =>
      (
        window as unknown as { renderPhase5Fixture: (view: string) => void }
      ).renderPhase5Fixture("populated"),
    );
    await expect(
      page.getByRole("heading", { name: "Trending Community Edges" }),
    ).toBeVisible();
    await expect(
      page.getByText("Stale source · reference withheld"),
    ).toBeVisible();
    await expect(
      page.getByText("Market reference 2.50", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("+1.5000", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(evidenceRoot, "phase5", `DEMO-populated-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
test("Phase 5 DEMO manual/review controls cannot type prices and recover from revalidation failure", async ({
  page,
}) => {
  const errors = await fixture(page, "admin", 390);
  await page
    .getByText("Evaluate a canonical market manually", { exact: true })
    .click();
  await expect(page.getByLabel("Canonical market ID")).toBeVisible();
  await expect(
    page.locator(
      'input[name="probability"],input[name="odds"],input[name="result"]',
    ),
  ).toHaveCount(0);
  await page.getByLabel("Approval reason").fill("DEMO isolated review only");
  await page
    .getByRole("button", {
      name: "Revalidate and approve research",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("DEMO: Candidate no longer qualifies. No change recorded.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Revalidate and approve research",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByText("Configure an audited scanner schedule", { exact: true })
    .click();
  await expect(
    page.getByLabel("Enable this schedule (global pause still applies)"),
  ).not.toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(evidenceRoot, "phase5", "DEMO-admin-revalidation-390.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
