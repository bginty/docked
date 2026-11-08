import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";

test("notification load failure offers retry without presenting default preference writes", async ({
  page,
}) => {
  const script = await bundleCommunityFixture(
    "tests/fixtures/notification-error.tsx",
  );
  const css = await readFile("src/app/globals.css", "utf8");
  const requests: string[] = [];
  await page.route("**/*", (route) => {
    requests.push(route.request().method());
    return route.fulfill({
      contentType: "text/html",
      body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="fixture-root"></main></body></html>',
    });
  });
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("https://fixture.invalid/notifications");
  await page.addStyleTag({ content: css });
  await page.evaluate(() =>
    window.addEventListener("fixture:router-refresh", () => {
      document.body.dataset.refreshed = "yes";
    }),
  );
  await page.addScriptTag({ content: script });
  await expect(page.getByRole("alert")).toContainText(
    "Notifications unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Save notification preferences" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark all read" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Retry notifications" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-refreshed", "yes");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(requests.every((method) => method === "GET")).toBe(true);
});
