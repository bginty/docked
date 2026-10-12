import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { previewReceipt as starterReceipt } from "../../src/components/pack-opening-preview";
import type { PackReceipt } from "../../src/core/pack-opening";
import {
  rarityConfiguration,
  rarityRule,
  type Rarity,
} from "../../src/core/card-rarity";
const tiers: Rarity[] = [
  "RARE",
  "ULTRA_RARE",
  "ICON",
  "ELITE",
  "LEGENDARY",
  "RARE",
  "ELITE",
  "RARE",
  "RARE",
];
const previewReceipt: PackReceipt = {
  ...starterReceipt,
  id: "nine-card-fixture",
  name: "Nine-card test pack",
  cards: starterReceipt.cards
    .slice(0, 9)
    .map((c, i) => ({
      ...c,
      tier: tiers[i],
      max_supply: rarityRule(tiers[i]).lifetimeCap!,
      serial: 1,
      rarity_version: rarityConfiguration.version,
      multiplier: rarityRule(tiers[i]).multiplierTenths / 10,
    })),
};
for (const width of [360, 412, 1366])
  test(`confirmed nine-card reveal, resume, replay and accessibility ${width}`, async ({
    page,
  }) => {
    let receipt: PackReceipt | null = null,
      opens = 0,
      fail = true;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 915 });
    await page.route("**/*", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/receipt") return route.fulfill({ json: receipt });
      if (path === "/open-pack") {
        opens++;
        receipt = previewReceipt;
        if (fail) {
          fail = false;
          return route.abort();
        }
        return route.fulfill({ json: receipt });
      }
      if (path.startsWith("/brand/"))
        return route.fulfill({
          body: await readFile("public" + path),
          contentType: "image/webp",
        });
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><head><title>Isolated pack acceptance</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
      });
    });
    const script = await bundleCommunityFixture(
      "tests/fixtures/pack-opening.tsx",
    );
    async function mount() {
      await page.goto("https://fixture.invalid/pack");
      for (const name of [
        "brand-theme",
        "globals",
        "fantasy",
        "fantasy-play",
        "pack-opening",
      ])
        await page.addStyleTag({
          content: await readFile(`src/app/${name}.css`, "utf8"),
        });
      await page.addScriptTag({ content: script });
      await page.getByRole("button", { name: "Open viewer" }).click();
    }
    await mount();
    await mkdir("docs/qa/economy-v2", { recursive: true });
    await page.screenshot({
      path: `docs/qa/economy-v2/sealed-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open pack seal" }).dblclick();
    await expect(page.getByRole("alert")).toContainText("Retry");
    expect(opens).toBe(1);
    // Response was lost AFTER the server committed. Reopening reads that same result.
    await mount();
    await expect(page.getByText("Card 1 of 9 · RARE")).toBeVisible();
    expect(opens).toBe(1);
    await page.getByRole("button", { name: "Reveal next" }).click();
    await expect(page.getByText("Card 2 of 9 · ULTRA RARE")).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.getByRole("button", { name: "Open viewer" }).click();
    await expect(page.getByText("Card 2 of 9 · ULTRA RARE")).toBeVisible();
    const inspect = page.getByRole("group", { name: /Inspect Preview QB 2/ });
    await inspect.focus();
    await inspect.press("ArrowRight");
    expect(
      await inspect.evaluate((el) => getComputedStyle(el).transform),
    ).not.toBe("none");
    await inspect.press("Escape");
    const axe = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({
      path: `docs/qa/economy-v2/revealed-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Reveal all", exact: true }).click();
    await expect(page.locator(".pack-summary li")).toHaveCount(9);
    await page.screenshot({
      path: `docs/qa/economy-v2/summary-${width}.png`,
      fullPage: true,
    });
    await mount();
    await expect(page.locator(".pack-summary li")).toHaveCount(9);
    expect(opens).toBe(1);
    await page
      .getByRole("button", { name: "Replay saved result · no new cards" })
      .click();
    await page.getByRole("button", { name: "Skip animation" }).click();
    await expect(page.getByText("Card 1 of 9 · RARE")).toBeVisible();
    expect(opens).toBe(1);
    await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
test("single card, reduced motion, keyboard opening and duplicate taps", async ({
  page,
}) => {
  let opens = 0;
  const receipt = {
    ...previewReceipt,
    id: "single",
    cards: previewReceipt.cards.slice(0, 1),
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/receipt") return route.fulfill({ json: null });
    if (p === "/open-pack") {
      opens++;
      await new Promise((r) => setTimeout(r, 150));
      return route.fulfill({ json: receipt });
    }
    if (p.startsWith("/brand/"))
      return route.fulfill({
        body: await readFile("public" + p),
        contentType: "image/webp",
      });
    return route.fulfill({
      contentType: "text/html",
      body: '<html lang="en"><title>Pack test</title><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
    });
  });
  await page.goto("https://fixture.invalid");
  for (const name of [
    "brand-theme",
    "globals",
    "fantasy",
    "fantasy-play",
    "pack-opening",
  ])
    await page.addStyleTag({
      content: await readFile(`src/app/${name}.css`, "utf8"),
    });
  await page.addScriptTag({
    content: await bundleCommunityFixture("tests/fixtures/pack-opening.tsx"),
  });
  await page.getByRole("button", { name: "Open viewer" }).click();
  await page.getByRole("button", { name: "Open pack seal" }).focus();
  const confirmed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/open-pack",
  );
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Close panel" }).click();
  await confirmed;
  await page.getByRole("button", { name: "Open viewer" }).click();
  await expect(page.getByText("Card 1 of 1 · RARE")).toBeVisible();
  expect(opens).toBe(1);
  await expect(
    page.getByRole("button", { name: "Skip animation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reveal all", exact: true }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".pack-case")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "Collection summary" }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(1);
});
