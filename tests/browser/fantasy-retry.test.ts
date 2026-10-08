import { test, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/fantasy-retry.tsx");
});
for (const scenario of ["ambiguous-then-rejected", "first-rejected"] as const)
  test(`Fantasy ${scenario} preserves only the appropriate retry identity`, async ({
    page,
  }) => {
    const requests: { request_id: string; action: string }[] = [];
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/fantasy") {
        requests.push(route.request().postDataJSON());
        const attempt = requests.length;
        if (attempt === 1)
          return route.fulfill({
            status: scenario === "first-rejected" ? 409 : 503,
            json: {
              error: "Authored transaction failure",
              outcome:
                scenario === "first-rejected" ? "rejected" : "unconfirmed",
            },
          });
        if (attempt === 2 && scenario === "ambiguous-then-rejected")
          return route.fulfill({
            status: 409,
            json: {
              error: "Authored receipt read rejection",
              outcome: "rejected",
            },
          });
        const state = await page.evaluate(() =>
          Reflect.get(window, "fantasyFixtureState"),
        );
        state.rewards.claimed_today = true;
        state.rewards.points = 10;
        return route.fulfill({ status: 200, json: { state, result: {} } });
      }
      if (url.pathname === "/retry-fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><title>Isolated retry fixture</title></head><body><main id="fixture-root"></main></body></html>',
        });
      return route.abort();
    });
    await page.goto("http://localhost:3000/retry-fixture");
    await page.addScriptTag({ content: bundle });
    await page
      .getByRole("button", { name: "Claim daily reward", exact: true })
      .click();
    const retry = page.getByRole("button", { name: "Retry pending action" });
    if (scenario === "ambiguous-then-rejected") {
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(
        page.getByText(/Authored receipt read rejection/),
      ).toBeVisible();
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(retry).toHaveCount(0);
      expect(requests).toHaveLength(3);
      expect(new Set(requests.map((r) => r.request_id)).size).toBe(1);
    } else {
      await expect(
        page.getByText(/Authored transaction failure/),
      ).toBeVisible();
      await expect(retry).toHaveCount(0);
      await page
        .getByRole("button", { name: "Claim daily reward", exact: true })
        .click();
      await expect(page.getByText("Saved securely.")).toBeVisible();
      expect(requests).toHaveLength(2);
      expect(new Set(requests.map((r) => r.request_id)).size).toBe(2);
    }
    expect(requests.every((r) => r.action === "claim_daily")).toBe(true);
  });
