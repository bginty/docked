import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startFoilStore } from "../fixtures/foil-store-server";
import catalogue from "../../design/foil-pack-rollout/catalogue-inventory.json";
import { foilArtworkVariants } from "../../src/core/foil-pack-artwork";
import { previewPackReceipt } from "../../src/components/pack-opening-preview";
import { mountPackFixture, packFixtureMarkup } from "../fixtures/pack-browser";

const out = "docs/qa/foil-pack-rollout-20261107";
let host: Awaited<ReturnType<typeof startFoilStore>>;
test.beforeAll(async () => {
  await mkdir(out, { recursive: true });
  host = await startFoilStore();
});
test.afterAll(async () => {
  await new Promise<void>((done, reject) =>
    host.server.close((e) => (e ? reject(e) : done())),
  );
});

for (const sport of ["nfl", "afl", "nrl"]) {
  test(`${sport} compact packaging in My Packs and history`, async ({
    page,
  }) => {
    for (const tab of ["mine", "history"]) {
      await page.goto(
        `${host.origin}/fantasy/cards?view=packs&sport=${sport}&packs=${tab}`,
      );
      const rows = page.locator(".pack-history-row");
      await expect(rows).toHaveCount(tab === "mine" ? 3 : 6);
      for (const row of await rows.all()) {
        await row.scrollIntoViewIfNeeded();
        const art = row.locator(".foil-pack-art");
        await expect(art).toHaveCount(1);
        expect((await art.boundingBox())!.width).toBeLessThanOrEqual(79);
        await expect
          .poll(() =>
            art
              .locator("img")
              .evaluate((el) => (el as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
      }
      await page.screenshot({ path: `${out}/${sport}-${tab}-mobile.png` });
    }
  });
}

test("catalogue changes, insufficient balance and unavailable products keep their restrictions", async ({
  page,
}) => {
  await page.route("**/api/review-store?*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.state.wallet.spendable = 0;
    body.state.products[0].price = 12345;
    body.state.products[0].available = false;
    body.state.products[0].availabilityReason =
      "Awaiting catalogue availability";
    await route.fulfill({ json: body });
  });
  await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=nrl`);
  await expect(page.locator(".pack-product")).toHaveCount(6);
  await expect(
    page
      .locator(".pack-product .pack-price strong")
      .filter({ hasText: "12,345" }),
  ).toHaveCount(1);
  for (const button of await page.locator(".pack-product button").all())
    await expect(button).toBeDisabled();
  await expect(page.getByText("Awaiting catalogue availability")).toBeVisible();
});

for (const sport of ["nfl", "afl", "nrl"]) {
  for (const width of [320, 360, 375, 390, 430, 768, 1440]) {
    test(`${sport} full catalogue, labels, prices and layout at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=${sport}`);
      await expect(page.locator(".pack-product")).toHaveCount(6);
      await expect(page.locator(".pack-product .pack-wrapper")).toHaveCount(0);
      const measurements = [];
      for (const p of catalogue.paid.filter((p) => p.sport === sport)) {
        const key = `${p.tier}:${sport}:${p.cards}`;
        const tile = page
          .locator(".pack-product")
          .filter({ has: page.locator(`[data-foil-variant="${key}"]`) });
        await tile.scrollIntoViewIfNeeded();
        const img = tile.locator("img");
        await expect
          .poll(() =>
            img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        await expect(img).toHaveAttribute(
          "alt",
          new RegExp(`${sport.toUpperCase()}.*${p.cards} card`),
        );
        await expect(tile.locator(".pack-price strong")).toHaveText(
          Number(p.price_credits).toLocaleString("en-AU"),
        );
        await expect(tile.locator(".pack-product-guarantee")).toHaveText(
          `${p.cards} ${p.cards === "1" ? "card" : "cards"}`,
        );
        const art = await img.boundingBox();
        const box = await tile.boundingBox();
        const button = await tile
          .getByRole("button", { name: /Buy/ })
          .boundingBox();
        expect(art!.width).toBeLessThanOrEqual(width <= 600 ? 117 : 181);
        expect(Math.abs(art!.height / art!.width - 1.5)).toBeLessThan(0.01);
        expect(button!.y + button!.height).toBeLessThanOrEqual(
          box!.y + box!.height + 1,
        );
        expect(button!.height).toBeGreaterThanOrEqual(44);
        measurements.push({ key, image: art, tile: box, button });
        if (width === 390)
          await tile.screenshot({
            path: `${out}/${p.tier.toLowerCase()}-${sport}-${p.cards}-store.png`,
          });
      }
      const starter = page.locator(`[data-foil-variant="STARTER:${sport}:4"]`);
      await starter.scrollIntoViewIfNeeded();
      await expect(starter.locator("img")).toHaveAttribute(
        "alt",
        new RegExp(`Weekly Starter ${sport.toUpperCase()}.*4 Core cards`),
      );
      if (width === 390) {
        await starter
          .locator("..")
          .screenshot({ path: `${out}/starter-${sport}-4-store.png` });
        await page.screenshot({
          path: `${out}/${sport}-store-full-mobile.png`,
          fullPage: true,
        });
      }
      await expect(
        page
          .getByRole("navigation", { name: "Sport" })
          .getByRole("button", { name: "NBA", exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await writeFile(
        `${out}/${sport}-layout-${width}.json`,
        JSON.stringify(measurements, null, 2),
      );
    });
  }
  test(`${sport} all purchase reviews preserve price and eligibility`, async ({
    page,
  }) => {
    const mutations: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") mutations.push(r.url());
    });
    await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=${sport}`);
    for (const p of catalogue.paid.filter((p) => p.sport === sport)) {
      const key = `${p.tier}:${sport}:${p.cards}`;
      const tile = page
        .locator(".pack-product")
        .filter({ has: page.locator(`[data-foil-variant="${key}"]`) });
      await tile.getByRole("button", { name: /Buy/ }).click();
      const review = page.locator(".pack-purchase-review");
      await expect(review.locator(".foil-pack-art")).toHaveAttribute(
        "data-foil-variant",
        key,
      );
      await expect(review.locator("dl")).toContainText(
        Number(p.price_credits).toLocaleString("en-AU"),
      );
      await review.screenshot({
        path: `${out}/${p.tier.toLowerCase()}-${sport}-${p.cards}-confirmation.png`,
      });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    expect(mutations).toEqual([]);
  });
}

test("21 finished designs and all enlarged Starter openings", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1000, height: 1600 });
  await page.goto(`${host.origin}/fantasy/cards?gallery=1`);
  await expect(page.locator(".foil-gallery .foil-pack-art")).toHaveCount(21);
  for (const img of await page.locator(".foil-gallery img").all()) {
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await img.evaluate((el) => (el as HTMLImageElement).decode());
  }
  for (const tier of ["STARTER", "STANDARD", "PREMIUM"]) {
    await page
      .locator(`[data-gallery-family="${tier}"]`)
      .screenshot({ path: `${out}/${tier.toLowerCase()}-all-variants.png` });
  }
  for (const sport of ["nfl", "afl", "nrl"]) {
    const tile = page.locator(".foil-gallery article").filter({
      has: page.locator(`[data-foil-variant="STARTER:${sport}:4"]`),
    });
    await tile.getByRole("button", { name: "Preview opening" }).click();
    await expect(page.locator(".branded-seal .foil-pack-art")).toHaveAttribute(
      "data-foil-variant",
      `STARTER:${sport}:4`,
    );
    await page.screenshot({ path: `${out}/starter-${sport}-4-opening.png` });
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .first()
      .click();
  }
});

for (const v of foilArtworkVariants.filter((v) => v.tier !== "STARTER")) {
  test(`${v.tier} ${v.sport} ${v.count}: actual opening and one issuance callback`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const sample = previewPackReceipt(v.sport);
    const receipt = {
      ...sample,
      name: `${v.tier} ${v.count} Pack`,
      cards: sample.cards.slice(0, v.count),
    };
    let opened = 0;
    await page.route("**/*", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/receipt") return route.fulfill({ json: null });
      if (path === "/open-pack") {
        opened++;
        return route.fulfill({ json: receipt });
      }
      return packFixtureMarkup(path).then((value) => route.fulfill(value));
    });
    await mountPackFixture(page, true, {
      sport: v.sport,
      premium: v.tier === "PREMIUM",
      count: v.count,
      name: receipt.name,
    });
    await expect(page.locator(".branded-seal .foil-pack-art")).toHaveAttribute(
      "data-foil-variant",
      `${v.tier}:${v.sport}:${v.count}`,
    );
    await page.screenshot({
      path: `${out}/${v.tier.toLowerCase()}-${v.sport}-${v.count}-opening.png`,
    });
    await page
      .getByRole("button", { name: "Open pack", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reveal All", exact: true }).click();
    await expect(page.locator(".pack-summary > li")).toHaveCount(v.count);
    expect(opened).toBe(1);
  });
}

test("slow artwork does not move product controls; increased text remains readable", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/packs/foil-v2/**", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=afl`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".pack-product")).toHaveCount(6);
  const before = await page
    .locator(".pack-product button")
    .first()
    .boundingBox();
  release();
  await expect
    .poll(() =>
      page
        .locator(".pack-product img")
        .first()
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const after = await page
    .locator(".pack-product button")
    .first()
    .boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".pack-product")
    .first()
    .screenshot({ path: `${out}/large-text-mobile.png` });
});

test("Samsung-sized full store walkthrough and deployed-before comparison", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: "test-results/foil-rollout-walkthrough",
      size: { width: 412, height: 915 },
    },
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const sport of ["nfl", "afl", "nrl"]) {
    await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=${sport}`);
    await expect(page.locator(".pack-product")).toHaveCount(6);
    for (const tile of await page.locator(".pack-product").all()) {
      await tile.scrollIntoViewIfNeeded();
      await page.waitForTimeout(650); // Intentional viewing time for recorded walkthrough.
    }
    await page.locator(".weekly-core-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
  }
  await page
    .locator('[data-family="PREMIUM"]')
    .evaluate((el) =>
      window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 100),
    );
  await page.screenshot({ path: `${out}/after-nrl-mobile.png` });
  await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=nrl&before=1`);
  await expect(page.locator(".pack-product")).toHaveCount(6);
  await page
    .locator('[data-family="PREMIUM"]')
    .evaluate((el) =>
      window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 100),
    );
  await page.screenshot({ path: `${out}/before-nrl-mobile.png` });
  const video = page.video();
  await context.close();
  await video?.saveAs(`${out}/samsung-sized-store-walkthrough.webm`);
});
