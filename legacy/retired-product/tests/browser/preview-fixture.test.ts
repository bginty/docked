import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import {
  buildPreviewFixture,
  previewFixtureOptions,
} from "../../src/core/preview-market-fixture";
import { previewPriceLabel } from "../../src/core/preview-market-contracts";
import path from "node:path";
let bundle: string;
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture();
});
async function fixture(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "DEMO: real operations blocked" },
    }),
  );
  await page.goto("/offline.html");
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>DEMO preview fixture regression</title></head><body><main id="demo-root"></main></body></html>',
  );
  for (const file of [
    "brand-theme.css",
    "globals.css",
    "community-app.css",
    "native.css",
    "mobile-app.css",
  ])
    await page.addStyleTag({ path: path.resolve("src/app", file) });
  await page.route("**/api/preview-edges", (route) =>
    route.fulfill({
      json: {
        status: "READY",
        label: previewPriceLabel,
        message: "DEMO only",
        options: previewFixtureOptions,
        records: [],
      },
    }),
  );
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => (window as any).renderDemo("mobile-preview-edge"));
  await expect(page.getByRole("note")).toContainText(
    "NO AUTHENTICATED SESSION",
  );
  await page
    .getByRole("button", { name: "DEMO Edge flow", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("football");
  await page
    .getByRole("combobox", { name: "Event", exact: true })
    .selectOption("demo-football");
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("DEMO regulation result");
  await page
    .getByRole("combobox", { name: "Selection", exact: true })
    .selectOption("DEMO Harbour FC");
  return errors;
}
test("preview composer binds synthetic reference, requires renewed confirmation and clears revoked data", async ({
  page,
}) => {
  const errors = await fixture(page);
  let reviews = 0;
  const submitted: Record<string, unknown>[] = [];
  await page.route("**/api/preview-edges", async (route) => {
    const input = route.request().postDataJSON();
    if (input.action === "review") {
      reviews++;
      const built = buildPreviewFixture(
        input.fixtureId
          ? { fixtureId: input.fixtureId, selection: input.selection }
          : null,
        `d0000000-0000-4000-8000-${String(reviews).padStart(12, "0")}`,
        new Date().toISOString(),
      );
      return route.fulfill({ json: { ok: true, review: built.review } });
    }
    submitted.push(input);
    return route.fulfill({
      json: {
        ok: true,
        id: "d0000000-0000-4000-8000-000000000099",
        submittedAt: new Date().toISOString(),
        label: previewPriceLabel,
      },
    });
  });
  const inspect = page.getByRole("button", {
    name: "Review DEMO market reference",
  });
  const save = page.getByRole("button", {
    name: "Save permanent PREVIEW record",
  });
  await inspect.click();
  await expect(save).toBeDisabled();
  await expect(page.locator(".preview-price-review")).toContainText(
    "DEMO Market Reference 2.08 decimal",
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("combobox", { name: "Selection", exact: true })
    .selectOption("Draw");
  await expect(save).toHaveCount(0);
  await inspect.click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(save).toBeDisabled();
  await page.getByRole("checkbox").check();
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Your preview test records" }),
  ).toBeVisible();
  expect(submitted).toHaveLength(1);
  expect(Object.keys(submitted[0]).sort()).toEqual([
    "action",
    "confirmed",
    "idempotencyKey",
    "reviewId",
    "reviewToken",
  ]);
  expect(submitted[0].reviewId).toBe("d0000000-0000-4000-8000-000000000002");
  await expect(page.locator(".preview-fixture-composer")).toContainText(
    "No settlement, points, ROI or ranking is assigned.",
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.route("**/api/preview-edges", (route) =>
    route.fulfill({ status: 403, json: { error: "DEMO entitlement revoked" } }),
  );
  await inspect.click();
  await expect(
    page.getByRole("heading", { name: "Your preview test records" }),
  ).toHaveCount(0);
  await expect(save).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Preview access or price review could not be confirmed",
  );
  expect(errors).toEqual([]);
});
test("selection changes abort pending preview review and cannot display an old reference", async ({
  page,
}) => {
  await fixture(page);
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route("**/api/preview-edges", async (route) => {
    const input = route.request().postDataJSON();
    started = true;
    const built = buildPreviewFixture(
      { fixtureId: input.fixtureId, selection: input.selection },
      "d0000000-0000-4000-8000-000000000010",
      new Date().toISOString(),
    );
    await held;
    try {
      await route.fulfill({ json: { ok: true, review: built.review } });
    } catch {
      /* Browser intentionally aborted this fictional request. */
    }
  });
  await page
    .getByRole("button", { name: "Review DEMO market reference" })
    .click();
  await expect.poll(() => started).toBe(true);
  await page
    .getByRole("combobox", { name: "Selection", exact: true })
    .selectOption("Draw");
  release!();
  await expect(page.locator(".preview-price-review")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Selection", exact: true }),
  ).toHaveValue("Draw");
  await expect(
    page.getByRole("button", { name: "Review DEMO market reference" }),
  ).toBeEnabled();
});
