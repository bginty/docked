import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { evidenceRoot } from "./evidence";
import { researchFactTypes } from "../../src/core/research-engine";
import { applicationStyles } from "../fixtures/application-styles";
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/research-demo.tsx");
  await mkdir(path.join(evidenceRoot, "research-ui"), { recursive: true });
});
async function fixture(page: Page, view: string, width: number) {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin === "http://localhost:3000" &&
      url.pathname === "/brand/fonts/Sora-Variable.ttf"
    )
      return route.fulfill({
        status: 200,
        contentType: "font/ttf",
        headers: { "access-control-allow-origin": "*" },
        body: await readFile("public/brand/fonts/Sora-Variable.ttf"),
      });
    return url.origin === "http://localhost:3000" &&
      ["/api/admin/research", "/api/notifications"].includes(url.pathname)
      ? route.fulfill({
          status: 200,
          headers: { "access-control-allow-origin": "*" },
          json: {
            ok: true,
            message: "DEMO action captured locally. No server mutation.",
          },
        })
      : route.abort();
  });
  await page.setContent(
    '<!doctype html><html lang="en"><head><base href="http://localhost:3000"><title>DEMO research UI</title></head><body><main class="community-shell"><aside class="app-sidebar" aria-label="DEMO navigation"><p class="small-note">DEMO navigation only</p></aside><div class="app-workspace"><div id="demo-root" class="app-content"></div></div></main></body></html>',
  );
  await applicationStyles(page, [
    "brand-theme.css",
    "globals.css",
    "sports-visuals.css",
    "sports-experience.css",
    "community-app.css",
    "native.css",
    "mobile-app.css",
    "beta-experience.css",
    "phase5-edges.css",
    "phase5c-research.css",
  ]);
  await page.evaluate((types) => {
    Object.assign(window, { researchFixtureFactTypes: types });
  }, researchFactTypes);
  await page.addScriptTag({ content: bundle });
  await render(page, view);
  return errors;
}
async function render(page: Page, view: string) {
  await page.evaluate(
    (view) =>
      (
        window as unknown as { renderResearchFixture: (view: string) => void }
      ).renderResearchFixture(view),
    view,
  );
  await expect(
    page.getByRole("heading", { name: "DEMO ONLY · research interface" }),
  ).toBeVisible();
  await expect(page.locator("[data-research-view]")).toHaveAttribute(
    "data-research-view",
    view,
  );
}
for (const width of [360, 412, 1366])
  test(`DEMO research missing evidence, conflicts and governed source states at ${width}px`, async ({
    page,
  }) => {
    const errors = await fixture(page, "dashboard", width);
    await expect(
      page.getByText("No reviewed source is configured.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("MODEL BLOCKED — DATA REQUIRED", { exact: true }),
    ).toBeVisible();
    expect(
      await page
        .locator(".research-model-blocked strong")
        .evaluate((el) => getComputedStyle(el).color),
    ).toBe("rgb(11, 31, 59)");
    await expect(page.locator(".research-summary dd").nth(0)).toHaveText(
      "Unknown",
    );
    for (const view of ["dashboard", "source", "match", "member", "detail"]) {
      await render(page, view);
      if (view === "source") {
        await expect(
          page.getByText("No successful fetch recorded", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Remaining provider quota: Unknown", { exact: false }),
        ).toBeVisible();
        const region = page.getByRole("region", {
          name: "Research source registry",
        });
        await region.focus();
        await expect(region).toBeFocused();
        if (width < 760) {
          await page.keyboard.press("ArrowRight");
          await expect
            .poll(() => region.evaluate((el) => el.scrollLeft))
            .toBeGreaterThan(0);
        }
      }
      if (view === "match") {
        await expect(
          page.getByText("Publication time not supplied by source", {
            exact: false,
          }),
        ).toBeVisible();
        await expect(
          page.getByText("Sources disagree.", { exact: false }),
        ).toBeVisible();
        await expect(
          page.getByText("DATA NOT AVAILABLE. No value is inferred.", {
            exact: true,
          }),
        ).toHaveCount(2);
        await expect(page.locator(".research-facts dd").first()).toHaveText(
          "0",
        );
        await expect(page.locator(".research-facts dd").nth(1)).toHaveText(
          "Data not available",
        );
      }
      if (view === "member")
        await expect(
          page.getByRole("link", {
            name: "Read facts, sources and missing data",
          }),
        ).toHaveAttribute(
          "href",
          "/research/matches/00000000-0000-4000-8000-000000000002",
        );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: path.join(
          evidenceRoot,
          "research-ui",
          `DEMO-${view}-${width}.png`,
        ),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
test("DEMO structured fact form preserves unknowns, captures observed time and cannot submit probability", async ({
  page,
}) => {
  const errors = await fixture(page, "form", 412);
  const requests: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/admin/research")
    )
      requests.push(request.postDataJSON());
  });
  await expect(page.locator("form")).toHaveAttribute(
    "data-research-ready",
    "true",
  );
  await page.getByLabel("Temperature °C", { exact: false }).fill("0");
  expect(
    await page.locator('input[name="temperatureCelsius"]').evaluate((el) => ({
      color: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    })),
  ).toEqual({ color: "rgb(11, 31, 59)", background: "rgb(255, 255, 255)" });
  await page
    .getByLabel("Forecast applies at", { exact: false })
    .fill("2026-10-04T12:00");
  await page
    .getByLabel("Source item identifier", { exact: true })
    .fill("DEMO-source-item");
  await page
    .getByLabel("Source revision identifier", { exact: true })
    .fill("DEMO-revision");
  await page
    .getByLabel("Source observed at", { exact: false })
    .fill("2026-10-04T00:00");
  await page
    .getByLabel("Effective from", { exact: false })
    .fill("2026-10-04T00:00");
  await page
    .getByLabel("Fact expires", { exact: false })
    .fill("2026-10-04T13:00");
  await page
    .getByLabel("Authorised source evidence URL", { exact: true })
    .fill("https://example.invalid/weather");
  await page
    .getByLabel("SHA-256 of retained authorised evidence", { exact: true })
    .fill("a".repeat(64));
  await page
    .getByLabel("Audit reason", { exact: true })
    .fill("DEMO structured observation for isolated UI test only.");
  await page
    .getByRole("button", { name: "Record for research review" })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "DEMO action captured locally. No server mutation.",
  );
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    action: "fact_record",
    eventId: "DEMO-event",
    sourcePublishedAt: null,
    confidence: "REPORTED",
    recordState: "ASSERTED",
    teamId: null,
    playerId: null,
    value: { temperatureCelsius: "0", windKph: null, precipitationMm: null },
  });
  expect(
    Number.isFinite(Date.parse(String(requests[0].sourceObservedAt))),
  ).toBe(true);
  expect(JSON.stringify(requests[0])).not.toMatch(
    /probability|fairOdds|estimatedEV/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  await render(page, "unsafe-attribution");
  await expect(page.locator('a[href*="token="]')).toHaveCount(0);
});

test("DEMO source governance defaults block use and research notifications remain separate opt-ins", async ({
  page,
}) => {
  const errors = await fixture(page, "dashboard", 412);
  await page
    .getByText("Register a new source review version", { exact: true })
    .click();
  const form = page
    .locator("details")
    .filter({ has: page.locator('select[name="rightsState"]') })
    .locator("form");
  await expect(form.locator('select[name="rightsState"]')).toHaveValue(
    "REVIEW_REQUIRED",
  );
  for (const key of [
    "commercialUse",
    "publicDisplay",
    "storagePermission",
    "derivedUse",
    "modelUse",
    "automation",
  ])
    await expect(form.locator(`select[name="${key}"]`)).toHaveValue("UNKNOWN");
  await expect(form.locator('input[type="checkbox"]:checked')).toHaveCount(0);
  for (const width of [412, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    const targets = await form
      .locator('input[type="checkbox"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => {
          const box = input.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }),
      );
    expect(targets).toHaveLength(researchFactTypes.length + 1);
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(24);
      expect(target.height).toBeGreaterThanOrEqual(24);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(
        evidenceRoot,
        "research-ui",
        `DEMO-source-form-${width}.png`,
      ),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 412, height: 844 });
  await render(page, "preferences");
  for (const key of ["researchUpdates", "lineupUpdates", "teamUpdates"])
    await expect(page.locator(`input[name="${key}"]`)).not.toBeChecked();
  await page.locator('input[name="researchUpdates"]').check();
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/notifications"),
  );
  await page
    .getByRole("button", { name: "Save notification preferences" })
    .click();
  expect((await request).postDataJSON()).toMatchObject({
    action: "preferences",
    researchUpdates: true,
    lineupUpdates: false,
    teamUpdates: false,
    email: false,
    push: false,
  });
  await expect(page.getByRole("status")).toContainText(
    "No external email or push is enabled",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});
