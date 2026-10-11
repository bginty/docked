import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import AxeBuilder from "@axe-core/playwright";
import { existsSync } from "node:fs";
test.skip(
  !existsSync("private-data/nfl-worker/owner-state.json"),
  "Requires the actual isolated hosted NFL read model; pure formation tests run without credentials",
);
test("NFL field selection, FLEX, replacement, confirmed save and honest points/EPL states", async ({
  page,
}) => {
  test.setTimeout(120000);
  const state = JSON.parse(
    await readFile("private-data/nfl-worker/owner-state.json", "utf8"),
  );
  // Local interaction fixture uses the actual read model, but no request reaches the backend.
  state.admin = false;
  state.entries = [];
  state.results = [];
  state.round_details = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let saves = 0;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/fantasy") {
      if (route.request().method() === "POST") {
        const input = route.request().postDataJSON();
        expect(input.action).toBe("save_lineup");
        expect(input.payload.cards).toHaveLength(7);
        state.entries = [
          {
            user_id: state.user_id,
            competition_id: state.competitions[0].id,
            cards: input.payload.cards,
          },
        ];
        saves++;
      }
      return route.fulfill({ json: { state, result: { saved: true } } });
    }
    if (url.pathname === "/fixture")
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><head><title>NFL local interaction acceptance</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
      });
    try {
      return route.fulfill({ body: await readFile("public" + url.pathname) });
    } catch {
      return route.abort();
    }
  });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("https://nfl.example.invalid/fixture");
  for (const name of [
    "brand-theme",
    "globals",
    "community-app",
    "mobile-app",
    "fantasy",
    "fantasy-play",
  ])
    await page.addStyleTag({
      content: await readFile("src/app/" + name + ".css", "utf8"),
    });
  await page.evaluate((s) => Reflect.set(window, "ownerQaState", s), state);
  await page.addScriptTag({
    content: await bundleCommunityFixture(
      "tests/fixtures/fantasy-acceptance.tsx",
    ),
  });
  await page.evaluate(() => Reflect.get(window, "renderFantasy")("play"));
  await expect(page.getByLabel("Fantasy sport")).toHaveValue("nfl");
  for (let i = 0; i < 7; i++) {
    await page.locator(".field-player.empty-slot").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator(".player-picker > button").first().click();
  }
  await expect(
    page.getByRole("button", { name: "Save Team", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("7/7 selected")).toBeVisible();
  await page.locator(".field-player").first().click();
  await page.getByPlaceholder("Search your eligible cards").fill("zzzzz");
  await expect(page.locator(".player-picker > button")).toHaveCount(0);
  await page.getByPlaceholder("Search your eligible cards").fill("");
  await page.locator(".player-picker > button").last().click();
  await page.getByRole("button", { name: "Save Team", exact: true }).click();
  await expect(page.getByText(/Team saved on the server/)).toBeVisible();
  expect(saves).toBe(1);
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.locator(".field-list")).toBeVisible();
  await page.getByRole("button", { name: "View Points", exact: true }).click();
  await expect(
    page.getByText("No saved scoring lineup available"),
  ).toBeVisible();
  await page.getByLabel("Fantasy sport").selectOption("football");
  await expect(
    page.getByRole("heading", { name: "EPL unavailable" }),
  ).toBeVisible();
  await page.getByLabel("Fantasy sport").selectOption("nfl");
  await page.getByRole("button", { name: "Pick Team", exact: true }).click();
  await mkdir("docs/qa/nfl-member", { recursive: true });
  await page.getByRole("button", { name: "Field view", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/qa/nfl-member/nfl-selected-s24.png",
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
