import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const base = "http://127.0.0.1:3023";
test("outer reveal frames, single forward turn and Icon celebration preserve the receipt", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 740 },
    recordVideo: {
      dir: "tmp/icon-reveal-video",
      size: { width: 412, height: 740 },
    },
  });
  await context.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  const page = await context.newPage();
  let mutations = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") mutations++;
  });
  await page.goto(base + "/preview/rarity-frames");
  await page.getByRole("button", { name: "Preview six-card reveal" }).click();
  for (let i = 0; i < 6; i++) {
    const stage = page.locator(`[data-reveal-index="${i}"]`);
    await expect(stage).toBeVisible();
    if (i === 5) {
      await expect(page.locator(".pack-icon-celebration")).toHaveCount(1);
      await page.waitForTimeout(1100);
      await page.screenshot({
        path: "docs/qa/rarity-frames/icon-celebration.png",
      });
    } else {
      await expect(page.locator(".pack-icon-celebration")).toHaveCount(0);
      if (i === 1) {
        const samples = await page
          .locator(".pack-arrival")
          .evaluate(async (el) => {
            const values: number[] = [];
            const start = performance.now();
            await new Promise<void>((resolve) => {
              const tick = () => {
                values.push(
                  new DOMMatrixReadOnly(getComputedStyle(el).transform).m11,
                );
                if (performance.now() - start > 2100) resolve();
                else requestAnimationFrame(tick);
              };
              tick();
            });
            return values;
          });
        expect(samples.length).toBeGreaterThan(10);
        for (let s = 1; s < samples.length; s++)
          expect(samples[s]).toBeGreaterThanOrEqual(samples[s - 1] - 0.035);
        expect(samples.at(-1)).toBeCloseTo(1, 4);
      }
    }
    const next = page.getByRole("button", {
      name: i === 5 ? "View pack summary" : "Reveal next card",
    });
    await expect(next).toBeEnabled();
    const caseCard = page.locator(".pack-case");
    expect(
      await caseCard.evaluate((e) => getComputedStyle(e).borderTopWidth),
    ).toBe("4px");
    expect(
      await caseCard
        .locator(".fantasy-card")
        .evaluate((e) => getComputedStyle(e).borderTopWidth),
    ).toBe("0px");
    expect(
      await page
        .locator(".pack-arrival")
        .evaluate((e) => getComputedStyle(e).transform),
    ).toBe("none");
    await expect(page.locator(".pack-card-back")).toBeHidden();
    const box = await caseCard.boundingBox();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y + box!.height).toBeLessThan(740);
    if (i === 1 || i === 5)
      await page.screenshot({
        path: `docs/qa/rarity-frames/reveal-outer-${i}.png`,
      });
    await next.click();
  }
  await expect(page.locator(".pack-summary li")).toHaveCount(6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Replay saved result · no new cards" })
    .click();
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Reveal next card" }).click();
  await expect(page.locator(".pack-icon-celebration")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View pack summary" }),
  ).toBeEnabled();
  expect(mutations).toBe(0);
  await context.close();
  await page.video()!.saveAs("docs/qa/rarity-frames/reveal-update.webm");
});
test("six rarity frames preserve jersey, identity, focus and legacy context across palettes and viewports", async ({
  page,
}) => {
  await mkdir("docs/qa/rarity-frames", { recursive: true });
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 412, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/preview/rarity-frames");
    const cards = page.locator('[data-preview="standard"] .fantasy-card');
    await expect(cards).toHaveCount(6);
    for (const palette of [
      "CHI",
      "WHITE",
      "KC",
      "BAL",
      "GB",
      "GOLD",
      "UNKNOWN",
    ]) {
      await page.getByLabel("Team palette").selectOption(palette);
      const shirts = await cards.evaluateAll((es) =>
        es.map((e) => getComputedStyle(e).getPropertyValue("--shirt").trim()),
      );
      expect(new Set(shirts).size).toBe(1);
      if (palette === "WHITE") expect(shirts[0]).toBe("#f3f4f6");
      if (palette === "GOLD") expect(shirts[0]).toBe("#d3bc8d");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const badge of await cards.locator(".rarity-badge").all()) {
        expect(
          await badge.evaluate(
            (e) =>
              e.scrollWidth <= e.clientWidth + 1 &&
              e.scrollHeight <= e.clientHeight + 1,
          ),
        ).toBe(true);
      }
      if (width === 1440 || palette === "CHI")
        await page.screenshot({
          path: `docs/qa/rarity-frames/${palette}-${width}.png`,
          fullPage: true,
        });
    }
    await page.getByLabel("Team palette").selectOption("CHI");
    await page.getByLabel("Long player name").check();
    await expect(
      cards
        .first()
        .getByRole("heading", { name: "Alex Northbridge-Wellington" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/qa/rarity-frames/long-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 412, height: 850 });
  await page.getByLabel("Long player name").uncheck();
  const face = page
    .locator('[data-preview="standard"] [role="button"]')
    .first();
  await face.focus();
  await expect(face).toBeFocused();
  const compact = page
    .locator('[data-preview="compact"] .rarity-frame')
    .first();
  const frameBackground = await compact.evaluate(
    (e) => getComputedStyle(e).backgroundImage,
  );
  await compact.hover();
  expect(
    await compact.evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toBe(frameBackground);
  await page
    .locator('[data-preview="standard"] [role="button"]')
    .last()
    .focus();
  await page.keyboard.press("Tab");
  await expect(compact).toBeFocused();
  expect(await compact.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
    "solid",
  );
  await face.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(face).toBeFocused();
  await expect(
    page
      .locator('[data-preview="standard"]')
      .getByText("#21 / 50", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-preview="standard"]')
      .getByText("Core · unlimited supply", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".rarity-gallery > div").last().locator(".rarity-badge-value"),
  ).toHaveText("1.0×");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".rarity-frame")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  const a = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a.violations).toEqual([]);
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "24px";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/qa/rarity-frames/enlarged.png",
    fullPage: true,
  });
});
