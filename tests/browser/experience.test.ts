import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { articles } from "../../src/content/articles";
import { evidenceRoot } from "./evidence";
test("isolated fixture edge states and honest no-edge work at 320px without public data insertion", async ({
  page,
}) => {
  const fixtures: Record<string, string> = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/render-experience.ts"],
      { encoding: "utf8" },
    ),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  for (const status of [
    "active",
    "price_below_minimum",
    "expired",
    "suspended",
    "settled",
  ] as const) {
    const html = fixtures[status];
    await page.setContent(
      `<!doctype html><html lang="en"><head><base href="http://localhost:3000"><title>Isolated fixture review</title></head><body><main class="page"><h1>Fictional UI fixture</h1>${html}</main></body></html>`,
    );
    await page.addStyleTag({
      path: path.join(process.cwd(), "src/app/globals.css"),
    });
    await page.addStyleTag({
      path: path.join(process.cwd(), "src/app/sports-visuals.css"),
    });
    await page.addStyleTag({
      path: path.join(process.cwd(), "src/app/sports-experience.css"),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `${evidenceRoot}/web-regression/sports-regression/regression-edge-${status}-320.png`,
      fullPage: true,
    });
  }
  const html = fixtures.no_edge;
  await page.setContent(
    `<!doctype html><html lang="en"><head><base href="http://localhost:3000"><title>Isolated no-edge fixture</title></head><body><main class="page"><h1>Fictional state review</h1>${html}</main></body></html>`,
  );
  await page.addStyleTag({
    path: path.join(process.cwd(), "src/app/globals.css"),
  });
  await page.addStyleTag({
    path: path.join(process.cwd(), "src/app/sports-visuals.css"),
  });
  await page.addStyleTag({
    path: path.join(process.cwd(), "src/app/sports-experience.css"),
  });
  await expect(
    page.getByRole("heading", { name: "No qualifying edge right now." }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `${evidenceRoot}/web-regression/sports-regression/regression-no-edge-isolated-fixture-320.png`,
    fullPage: true,
  });
});
test("article metadata, real PNG social card and allowlisted sports pages", async ({
  page,
  request,
}) => {
  await page.goto("/learn/minimum-odds");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/learn\/minimum-odds$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const data = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerText(),
  );
  expect(data["@type"]).toBe("WebPage");
  expect(data.datePublished).toBeUndefined();
  await expect(
    page.getByRole("heading", { name: "Corrections and review" }),
  ).toBeVisible();
  for (const route of [
    "/sports",
    "/sports/football",
    "/sports/nba",
    "/sports/nfl",
    "/leagues/nba",
  ]) {
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
  }
  expect((await request.get("/sports/nonexistent")).status()).toBe(404);
  expect((await request.get("/leagues/nonexistent")).status()).toBe(404);
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
});
test("preview public pages remain truthful, accessible and usable without an account", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const [name, route] of Object.entries({
    homepage: "/",
    edges: "/edges",
    results: "/results",
    methodology: "/methodology",
    article: "/learn/minimum-odds",
    signup: "/join",
    "member-dashboard-locked": "/dashboard",
    "admin-dashboard-locked": "/admin",
    "data-health-locked": "/admin/data-health",
    "forward-paper-locked": "/admin/forward-paper",
  })) {
    expect((await page.goto(route))?.status(), route).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    if (route === "/results") {
      const tableRegion = page.getByRole("region", {
        name: "Live publication ledger table, scroll horizontally if needed",
      });
      await tableRegion.focus();
      await expect(tableRegion).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
      route,
    ).toEqual([]);
    await page.screenshot({
      path: `${evidenceRoot}/web-regression/sports-regression/regression-${name}-390.png`,
      fullPage: true,
    });
  }
  await page.goto("/join");
  for (const input of await page.locator("input[type=checkbox]").all())
    await expect(input).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /optional usage analytics/ }),
  ).not.toBeChecked();
  for (const article of articles) {
    await page.goto(`/learn/${article.slug}`);
    await expect(
      page.getByRole("heading", { name: article.title, exact: true }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
  const response = await request.get("/api/edges");
  expect(response.status()).toBe(200);
  expect((await response.json()).tips).toEqual([]);
  const health = await (await request.get("/api/status")).json();
  expect(health.oddsProviderStatus).toBe("NOT_CONFIGURED");
  expect(health.resultsProviderStatus).toBe("NOT_CONFIGURED");
  expect(health.feed).toBe(false);
  await page.goto("/results");
  await expect(
    page.getByText(
      "No accessible live publications. No demonstration figures are included.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Settled publications").locator("..").locator("strong"),
  ).toHaveText("N/A");
  const exported = await request.get("/api/member");
  expect(exported.status()).toBe(401);
  const deleted = await request.post("/api/member", {
    headers: { Origin: "http://localhost:3000" },
    data: { action: "delete", confirm: "DELETE" },
  });
  expect(deleted.status()).toBe(403);
  expect(errors).toEqual([]);
});
