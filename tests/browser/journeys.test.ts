import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { evidenceRoot } from "./evidence";
test("desktop and mobile home, keyboard access, no storefront and accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Only when the price offers value." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('script[src*="paypal"]')).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    const skipBounds = await page
      .getByRole("link", { name: "Skip to content" })
      .boundingBox();
    const brandBounds = await page
      .getByRole("link", { name: "Docked home" })
      .boundingBox();
    expect(skipBounds).not.toBeNull();
    expect(brandBounds).not.toBeNull();
    expect(skipBounds!.y + skipBounds!.height).toBeLessThanOrEqual(
      brandBounds!.y,
    );
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({
      path: `${evidenceRoot}/web-regression/sports-regression/regression-home-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("education and pending research are usable without an account", async ({
  page,
}) => {
  for (const route of [
    "/learn",
    "/learn/minimum-odds",
    "/methodology",
    "/research",
    "/results",
    "/data-status",
    "/safer-gambling",
    "/contact",
    "/privacy",
    "/terms",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.locator("body").innerText()).not.toContain(
      "Application error",
    );
  }
  await page.goto("/results");
  await expect(
    page.getByText(
      "No accessible live publications. No demonstration figures are included.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "The complete record" }),
  ).toBeVisible();
});
test("restricted public/API, protected admin and no fake signup success", async ({
  page,
  request,
}) => {
  await page.goto("/edges");
  await expect(
    page.getByRole("heading", { name: "Not available in your region" }),
  ).toBeVisible();
  const edges = await request.get("/api/edges");
  expect((await edges.json()).tips).toEqual([]);
  expect(edges.headers()["cache-control"]).toContain("no-store");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Verified access required." }),
  ).toBeVisible();
  const denied = await request.post("/api/admin", {
    headers: { Origin: "http://localhost:3000" },
    data: { action: "pause", key: "publication" },
  });
  expect(denied.status()).toBe(403);
  await page.goto("/join");
  await expect(
    page.getByRole("button", { name: "Create free account" }),
  ).toBeDisabled();
  const boxes = page.locator("input[type=checkbox]");
  for (const box of await boxes.all()) await expect(box).not.toBeChecked();
});
test("retired product routes, legacy support and invalid unsubscribe", async ({
  page,
  request,
}) => {
  await page.goto("/products/cruise-d2");
  await expect(page).toHaveURL(/legacy-support/);
  await expect(
    page.getByRole("heading", { name: "Legacy product support", exact: true }),
  ).toBeVisible();
  const response = await request.post("/api/unsubscribe?token=invalid");
  expect(response.status()).toBe(400);
  const tampered = await request.post("/api/webhooks/email", {
    data: { type: "email.complained" },
  });
  expect([400, 503]).toContain(tampered.status());
  await page.goto("/tips/00000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("heading", { name: "Nothing published here." }),
  ).toBeVisible();
});
test("secondary routes pass automated accessibility scan", async ({ page }) => {
  for (const route of [
    "/join",
    "/edges",
    "/results",
    "/learn/minimum-odds",
    "/dashboard",
    "/admin",
  ]) {
    await page.goto(route);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations, route).toEqual([]);
  }
});
