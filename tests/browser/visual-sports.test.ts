import { test, expect, type Locator, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sports } from "../../src/content/sports";

const evidenceDirectory = path.join(
  process.cwd(),
  "docs/qa/phase3/after/sports-regression",
);
const routes = {
  homepage: "/",
  edges: "/edges",
  results: "/results",
  learn: "/learn",
  article: "/learn/minimum-odds",
  sports: "/sports",
  "sport-football": "/sports/football",
  "sport-basketball": "/sports/basketball",
  "sport-tennis": "/sports/tennis",
  "member-locked": "/dashboard",
  "admin-locked": "/admin",
};

async function expectStaticResponsivePhoto(photo: Locator) {
  const source = new URL(
    await photo.evaluate((image) => (image as HTMLImageElement).currentSrc),
  );
  expect(source.origin).toBe("http://localhost:3000");
  expect(source.pathname).toMatch(
    /^\/images\/sports\/(?:responsive\/)?[a-z0-9-]+\.webp$/,
  );
  await expect(photo).toHaveAttribute(
    "srcset",
    /\/images\/sports\/responsive\/.+\.webp \d+w/,
  );
  await photo.evaluate((image) => (image as HTMLImageElement).decode());
}

for (const width of [390, 430, 768, 1366, 1920]) {
  test(`sports identity remains accessible and honest at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await mkdir(evidenceDirectory, { recursive: true });
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    const optimizerRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/_next/image")
        optimizerRequests.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const scanned: {
      route: string;
      decorativePhotos: number;
      violations: number;
    }[] = [];
    for (const [name, route] of Object.entries(routes)) {
      expect(
        (await page.goto(route, { waitUntil: "networkidle" }))?.status(),
      ).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      // Load below-fold photos before the screenshot; this is deliberately separate from performance measurement.
      for (const photo of await page.locator(".sport-image img").all()) {
        await photo.scrollIntoViewIfNeeded();
        await expect(photo).toHaveAttribute("alt", "");
        await expect
          .poll(() =>
            photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        await expectStaticResponsivePhoto(photo);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route,
      ).toBe(true);
      if (route === "/edges") {
        await expect(
          page.getByRole("heading", { name: "Not available in your region" }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "No qualifying edge right now." }),
        ).toHaveCount(0);
      }
      if (route === "/results") {
        await expect(
          page
            .getByText("Settled publications")
            .locator("..")
            .locator("strong"),
        ).toHaveText("N/A");
      }
      if (route === "/dashboard")
        await expect(
          page.getByRole("heading", {
            name: "Sign in to your verified account",
          }),
        ).toBeVisible();
      if (route === "/admin")
        await expect(
          page.getByRole("heading", { name: "Verified access required." }),
        ).toBeVisible();
      const violations = (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations;
      expect(violations, route).toEqual([]);
      scanned.push({
        route,
        decorativePhotos: await page.locator(".sport-image img").count(),
        violations: violations.length,
      });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: path.join(evidenceDirectory, `${name}-${width}.png`),
        fullPage: true,
      });
    }
    await writeFile(
      path.join(evidenceDirectory, `browser-${width}.json`),
      JSON.stringify({ width, errors, optimizerRequests, scanned }, null, 2) +
        "\n",
    );
    expect(errors).toEqual([]);
    expect(optimizerRequests).toEqual([]);
  });
}

test("all ten sport routes decode local optimized photos and retain explicit coverage status", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const sport of sports) {
    const route = `/sports/${sport.slug}`;
    expect(
      (await page.goto(route, { waitUntil: "networkidle" }))?.status(),
    ).toBe(200);
    await expect(page.locator("h1")).toHaveText(sport.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${route}$`),
    );
    await expect(
      page.locator(".sport-page-hero .sport-coverage-badge"),
    ).toHaveText(
      ["football", "basketball"].includes(sport.slug)
        ? "Research coverage"
        : "Coming soon",
    );
    const photo = page.locator(".sport-page-photo img");
    await expect(photo).toHaveAttribute("alt", "");
    await expect
      .poll(() =>
        photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expectStaticResponsivePhoto(photo);
    await expect(page.locator(".sport-opportunities .edge-card")).toHaveCount(
      0,
    );
    await expect(page.locator(".sport-quiet-state")).toContainText(
      ["football", "basketball"].includes(sport.slug)
        ? "does not imply a completed scan or a live feed"
        : "no active pricing pipeline",
    );
  }
  const legacy = await request.get("/sports/nba", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toBe("/sports/basketball");
  expect(errors).toEqual([]);
});

test("cancelled atmosphere and motorsport photo loads recover on immediate revisit without a runtime optimizer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const optimizerRequests: string[] = [],
    errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/_next/image")
      optimizerRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [asset, route] of Object.entries({
    "atmosphere-football": "/learn/no-tip-is-correct",
    motorsport: "/sports/motorsport",
  })) {
    let cancelled = false;
    const cancelFirst = async (imageRequest: Route) => {
      if (!cancelled && imageRequest.request().url().includes(asset)) {
        cancelled = true;
        await imageRequest.abort("aborted");
      } else await imageRequest.continue();
    };
    // A browser-only interrupted load; all revisits fetch and decode the real local asset.
    await page.route("**/images/sports/**", cancelFirst);
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect.poll(() => cancelled).toBe(true);
    await page.goto("/methodology", { waitUntil: "domcontentloaded" });
    await page.unroute("**/images/sports/**", cancelFirst);
    await page.goto(route, { waitUntil: "networkidle" });
    const photo = page.locator(".sport-image img").first();
    await expect
      .poll(() =>
        photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expectStaticResponsivePhoto(photo);
  }
  expect(optimizerRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("atmospheric no-edge imagery preserves restricted and outage meanings", async ({
  page,
}) => {
  await mkdir(evidenceDirectory, { recursive: true });
  const fixtures: Record<string, string> = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/render-experience.ts"],
      { encoding: "utf8" },
    ),
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  for (const [state, title] of Object.entries({
    no_edge: "No qualifying edge right now.",
    restricted: "Not available in your region",
    outage: "Provider feed unavailable",
  })) {
    await page.setContent(
      `<!doctype html><html lang="en"><head><base href="http://localhost:3000"><title>Isolated state review</title></head><body><main class="page"><h1>Fictional state review</h1>${fixtures[state]}</main></body></html>`,
    );
    for (const file of [
      "globals.css",
      "sports-visuals.css",
      "sports-experience.css",
    ])
      await page.addStyleTag({
        path: path.join(process.cwd(), "src/app", file),
      });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    if (state !== "no_edge")
      await expect(
        page.getByRole("heading", { name: "No qualifying edge right now." }),
      ).toHaveCount(0);
    await expect(page.locator(".no-edge-photo img")).toHaveAttribute("alt", "");
    await expect
      .poll(() =>
        page
          .locator(".no-edge-photo img")
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(evidenceDirectory, `fixture-${state}-390.png`),
      fullPage: true,
    });
  }
});
