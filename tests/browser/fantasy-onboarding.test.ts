import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
test("fantasy onboarding keeps optional notifications off and survives failed saving", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  const posts: Record<string, unknown>[] = [];
  let failed = true;
  await page.route("**/*", (route) => {
    if (route.request().url().endsWith("/api/member")) {
      posts.push(route.request().postDataJSON());
      return route.fulfill({
        status: failed ? 503 : 200,
        json: failed
          ? { error: "Fixture outage — preferences not saved" }
          : { ok: true },
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Fantasy onboarding fixture</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
    });
  });
  await page.goto("https://fixture.invalid/onboarding");
  for (const file of ["brand-theme", "globals", "app-auth", "fantasy"])
    await page.addStyleTag({
      content: await readFile("src/app/" + file + ".css", "utf8"),
    });
  await page.addScriptTag({
    content: await bundleCommunityFixture(
      "tests/fixtures/fantasy-onboarding.tsx",
    ),
  });
  await page.getByRole("checkbox", { name: "Football", exact: true }).check();
  await page.screenshot({
    path: "docs/qa/fantasy-cleanup/onboarding-sports-412.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("Fantasy competitions", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/qa/fantasy-cleanup/onboarding-interests-412.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue" }).click();
  for (const item of await page.getByRole("checkbox").all())
    await expect(item).not.toBeChecked();
  await expect(page.locator("body")).not.toContainText(
    /Official Edge|Live Edge/,
  );
  await page.getByRole("button", { name: "Enter Docked" }).click();
  await expect(page.getByRole("status")).toContainText("Fixture outage");
  expect(posts[0].officialEdges).toBe(false);
  expect(posts[0].sports).toEqual(["football"]);
  expect(posts[0].followedMembers).toBe(false);
  expect(posts[0]).not.toHaveProperty("marketing");
  await page.screenshot({
    path: "docs/qa/fantasy-cleanup/onboarding-error-412.png",
    fullPage: true,
  });
  failed = false;
  await page.getByRole("button", { name: "Enter Docked" }).click();
  await expect.poll(() => posts.length).toBe(2);
  const a = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a.violations.map((v) => v.id)).toEqual([]);
});
