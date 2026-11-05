import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
test.use({ channel: "msedge" });
test("existing-member public form uses explicit current legal links and preserves choices on failure", async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  await page.route("**/*", (route) => {
    if (route.request().url().endsWith("/api/auth/public-member-setup")) {
      posts.push(route.request().postDataJSON());
      return route.fulfill({
        status: 503,
        json: { error: "Isolated fixture outage; no account changed." },
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Isolated existing-member setup</title></head><body><main id="fixture-root"></main></body></html>',
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("https://fixture.invalid/app/onboarding/public");
  for (const file of ["brand-theme", "globals", "app-auth"])
    await page.addStyleTag({
      content: await readFile(`src/app/${file}.css`, "utf8"),
    });
  await page.addScriptTag({
    content: await bundleCommunityFixture(
      "tests/fixtures/public-member-setup.tsx",
    ),
  });
  await expect(
    page.getByRole("link", { name: "Terms", exact: true }),
  ).toHaveAttribute("href", "/commercial-policy");
  await expect(
    page.getByRole("link", { name: "Privacy Policy", exact: true }),
  ).toHaveAttribute("href", "/privacy");
  for (const box of await page.getByRole("checkbox").all())
    await expect(box).not.toBeChecked();
  await expect(page.getByRole("textbox", { name: "Country code" })).toHaveValue(
    "",
  );
  await page.screenshot({
    path: "docs/qa/onboarding-transition-20261105/public-form-390.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "docs/qa/onboarding-transition-20261105/public-form-1440.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Public username" })
    .fill("review_fixture");
  await page.getByRole("textbox", { name: "Country code" }).fill("AU");
  await page.getByRole("textbox", { name: "State / region" }).fill("NSW");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "NFL", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("NBA");
  await page.getByRole("checkbox", { name: "NFL", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Enter Docked", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Isolated fixture outage",
  );
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    age: true,
    terms: true,
    privacy: true,
    country: "AU",
    state: "NSW",
    sports: ["nfl"],
  });
  expect(posts[0]).not.toHaveProperty("user_id");
  expect(posts[0]).not.toHaveProperty("role");
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Public username" }),
  ).toHaveValue("review_fixture");
  await expect(page.getByRole("textbox", { name: "Country code" })).toHaveValue(
    "AU",
  );
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
