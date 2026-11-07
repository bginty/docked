import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startFoilStore } from "../fixtures/foil-store-server";
import { paidPackOffers } from "../../src/core/paid-pack-catalogue";
import { finishedFoilPack } from "../../src/core/foil-pack-artwork";

const out = "docs/qa/foil-pack-review-20261107";
let host: Awaited<ReturnType<typeof startFoilStore>>;
test.beforeAll(async () => {
  await mkdir(out, { recursive: true });
  host = await startFoilStore();
});
test.afterAll(async () => {
  await new Promise<void>((done, reject) =>
    host.server.close((error) => (error ? reject(error) : done())),
  );
});

for (const sport of ["nfl", "afl", "nrl"] as const) {
  test(`${sport}: all six real catalogue variants keep correct sport, quantity and price`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=${sport}`);
    await expect(
      page.getByRole("heading", {
        name: `${sport.toUpperCase()} Packs`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Sport" })
        .getByRole("button", { name: "NBA", exact: true }),
    ).toHaveCount(0);
    const records = [];
    for (const offer of paidPackOffers) {
      const tile = page.locator(".pack-product").filter({
        has: page.getByRole("heading", { name: offer.name, exact: true }),
      });
      await expect(tile).toHaveCount(1);
      await expect(
        tile.getByRole("heading", { name: offer.name, exact: true }),
      ).toBeVisible();
      await expect(tile.locator(".pack-product-guarantee")).toHaveText(
        `${offer.cards} ${offer.cards === 1 ? "card" : "cards"}`,
      );
      await expect(tile.locator(".pack-price strong")).toHaveText(
        offer.priceCredits.toLocaleString("en-AU"),
      );
      const asset = finishedFoilPack({
        name: offer.name,
        sport,
        count: offer.cards,
        premium: offer.type === "PREMIUM",
      });
      if (asset) {
        await expect(tile.locator(".foil-pack-art")).toHaveAttribute(
          "data-foil-variant",
          asset.key,
        );
        await expect(
          tile.getByRole("img", { name: asset.label, exact: true }),
        ).toBeVisible();
        expect(
          await tile
            .locator(".foil-pack-art img")
            .evaluate((img) => (img as HTMLImageElement).naturalWidth),
        ).toBeGreaterThan(0);
        expect(await tile.locator(".foil-pack-art").innerText()).toBe("");
      } else {
        await expect(tile.locator(".foil-pack-art")).toHaveCount(0);
        await expect(tile.locator(".pack-art-sport")).toHaveText(
          sport.toUpperCase(),
        );
        await expect(tile.locator(".pack-art-count")).toContainText(
          String(offer.cards),
        );
      }
      records.push({
        sport,
        type: offer.type,
        count: offer.cards,
        credits: offer.priceCredits,
        artwork: asset?.key ?? "existing correctly-labelled artwork",
      });
    }
    await writeFile(
      `${out}/${sport}-variants.json`,
      JSON.stringify(records, null, 2),
    );
    const response = await page.request.post(`${host.origin}/api/review-store`);
    expect(response.status()).toBe(405);
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 390, 1366]) {
  for (const [sport, family] of [
    ["afl", "STANDARD"],
    ["nrl", "PREMIUM"],
  ] as const) {
    test(`${sport} finished store tile and enlarged pack at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 320 ? 740 : 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=${sport}`);
      const art = page
        .locator(`[data-foil-variant="${family}:${sport}:9"]`)
        .first();
      await expect(art).toBeVisible();
      const tile = page.locator(".pack-product").filter({ has: art });
      await page.locator(`[data-family="${family}"]`).evaluate((el) =>
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - 100,
        }),
      );
      await page.screenshot({ path: `${out}/${sport}-store-${width}.png` });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await tile.getByRole("button", { name: /Buy/ }).click();
      await expect(
        page.locator(".pack-purchase-review .foil-pack-art"),
      ).toBeVisible();
      await page.screenshot({
        path: `${out}/${sport}-purchase-preview-${width}.png`,
      });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("button", { name: "Enlarged opening preview", exact: true })
        .click();
      await expect(page.locator(".foil-opening-sealed")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open pack", exact: true }),
      ).toBeInViewport();
      await page.screenshot({ path: `${out}/${sport}-enlarged-${width}.png` });
      await page
        .getByRole("button", { name: "Open pack", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Reveal card", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Reveal All", exact: true })
        .click();
      await expect(page.locator(".pack-summary>li")).toHaveCount(9);
      await expect(page.locator(".pack-summary")).not.toContainText("Core");
      if (family === "PREMIUM")
        await expect(page.locator(".pack-summary")).not.toContainText("Elite");
    });
  }
}

test("premium tear, nine-card fan and existing Legendary reveal", async ({
  page,
}) => {
  await page.goto(`${host.origin}/fantasy/cards?view=packs&sport=nrl`);
  await page.getByRole("button", { name: "Enlarged opening preview" }).click();
  await page.waitForTimeout(1000); // Deliberate readable dwell for the review video.
  const cadence = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const frames: number[] = [];
        const start = performance.now();
        let previous = start;
        function sample(now: number) {
          frames.push(now - previous);
          previous = now;
          if (now - start < 8000) requestAnimationFrame(sample);
          else resolve(frames);
        }
        requestAnimationFrame(sample);
      }),
  );
  await page.getByRole("button", { name: "Open pack", exact: true }).click();
  await expect(page.locator(".foil-opening-tearing")).toBeVisible();
  await page.waitForTimeout(850);
  await page.screenshot({ path: `${out}/premium-tearing.png` });
  await expect(
    page.getByRole("button", { name: "Reveal card", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  await page.screenshot({ path: `${out}/premium-legendary-reveal.png` });
  await page.waitForTimeout(1500);
  const frames = (await cadence).slice(1).sort((a, b) => a - b);
  await writeFile(
    `${out}/browser-frame-timing.json`,
    JSON.stringify(
      {
        environment:
          "Headless desktop Edge, 390x844 viewport; not Android device acceptance",
        samples: frames.length,
        medianFrameMs: frames[Math.floor(frames.length / 2)],
        p95FrameMs: frames[Math.floor(frames.length * 0.95)],
        meanFramesPerSecond:
          1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
        over50ms: frames.filter((v) => v > 50).length,
      },
      null,
      2,
    ),
  );
  const video = page.video();
  await page.close();
  await video?.saveAs(`${out}/premium-opening-review.webm`);
});

test("before image uses the unchanged store artwork", async ({ page }) => {
  await page.goto(
    `${host.origin}/fantasy/cards?view=packs&sport=nrl&classic=1`,
  );
  await expect(
    page.getByRole("heading", { name: "NRL Packs", exact: true }),
  ).toBeVisible();
  await page.locator('[data-family="PREMIUM"]').evaluate((el) =>
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 100,
    }),
  );
  await expect(page.locator(".pack-product .foil-pack-art")).toHaveCount(0);
  await page.screenshot({ path: `${out}/before-nrl-store-390.png` });
});
