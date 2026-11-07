import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  previewPackReceipt,
  type PreviewSport,
} from "../../src/components/pack-opening-preview";
import { mountPackFixture, packFixtureMarkup } from "../fixtures/pack-browser";
import type { PackReceipt } from "../../src/core/pack-opening";
import { bundleCommunityFixture } from "../fixtures/bundle-community";

async function mount(page: Page, receipt: PackReceipt, prototype = true) {
  let opens = 0;
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/receipt") return route.fulfill({ json: null });
    if (path === "/open-pack") {
      opens++;
      return route.fulfill({ json: receipt });
    }
    return route.fulfill(await packFixtureMarkup(path));
  });
  await mountPackFixture(page, prototype);
  await page.getByRole("button", { name: "Open pack seal" }).click();
  return () => opens;
}

for (const sport of ["afl", "nfl", "nrl"] as PreviewSport[]) {
  test(`V2 ${sport}: both tiers use the confirmed card, preserve identity until turn, one issuance`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 850 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const receipt = previewPackReceipt(sport);
    receipt.cards = receipt.cards.slice(4, 6);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const opens = await mount(page, receipt);
    for (const card of receipt.cards) {
      const scene = page.locator(".cinema-v2");
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "mystery");
      await expect(scene).not.toHaveAttribute("data-tier");
      await expect(scene.locator(".fantasy-card")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Reveal card", exact: true })
        .click();
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "rarity");
      await expect(scene.locator(".fantasy-card")).toHaveCount(0);
      await expect(scene.locator(".cinema-v2-announcement")).toContainText(
        card.tier,
      );
      await expect(scene.locator("canvas")).toHaveCount(2);
      await expect(scene).toHaveAttribute(
        "data-pack-reveal-phase",
        "flipping",
        { timeout: 5000 },
      );
      await expect(scene.locator(".cinema-v2-front")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "revealed");
      await expect(scene.locator(".fantasy-card")).toContainText(card.name);
      await expect(scene.locator(".fantasy-card")).toHaveCount(1);
      await expect(scene.locator(".cinema-v2-front")).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      await expect(
        page.getByRole("button", { name: "Share My Pull", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: card.tier === "ICON" ? "View pack summary" : "Reveal next card",
        })
        .click();
    }
    await expect(page.locator(".pack-summary > li")).toHaveCount(2);
    expect(opens()).toBe(1);
    expect(errors).toEqual([]);
  });
}

test("V2 is opt-in: ordinary receipts and lower rarities keep V1", async ({
  page,
}) => {
  await mount(page, previewPackReceipt("afl", "LEGENDARY"), false);
  await expect(page.locator(".cinema-v2")).toHaveCount(0);
  await expect(page.locator(".pack-cinematic")).toHaveCount(1);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.unrouteAll();
  await mount(page, previewPackReceipt("afl", "CORE"));
  await expect(page.locator(".cinema-v2")).toHaveCount(0);
  await expect(page.locator(".pack-cinematic")).toHaveCount(1);
});

test("V2 rapid inputs, skip, Reveal All, resume and replay do not reissue nine cards", async ({
  page,
}) => {
  const receipt = previewPackReceipt("afl");
  // Same deterministic nine cards; first is Legendary for the interruption check.
  [receipt.cards[0], receipt.cards[4]] = [receipt.cards[4], receipt.cards[0]];
  const opens = await mount(page, receipt);
  await page
    .getByRole("button", { name: "Reveal card", exact: true })
    .evaluate((el) => {
      for (let i = 0; i < 8; i++) (el as HTMLButtonElement).click();
    });
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "rarity",
  );
  await page.getByRole("button", { name: "Skip animation" }).click();
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  await page.getByRole("button", { name: "Reveal All", exact: true }).click();
  await expect(page.locator(".pack-summary > li")).toHaveCount(9);
  await page
    .getByRole("button", { name: "Replay saved result · no new cards" })
    .click();
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "mystery",
  );
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.locator(".cinema-v2")).toHaveCount(0);
  await page.getByRole("button", { name: "Open viewer" }).click();
  await expect(page.locator(".pack-summary > li")).toHaveCount(9);
  expect(opens()).toBe(1);
});

test("V2 reduced motion has no animation, no Canvas loop; reveal and share stay accessible at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page, previewPackReceipt("afl", "ICON"));
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  const scene = page.locator(".cinema-v2");
  await expect(scene).toHaveAttribute("data-pack-reveal-phase", "revealed");
  expect(
    await scene.evaluate(
      (el) =>
        el
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === "running").length,
    ),
  ).toBe(0);
  await page.waitForTimeout(650);
  expect(await scene.getAttribute("data-vfx-frames")).toBeNull();
  await expect(
    page.getByRole("button", { name: "Share My Pull", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "View pack summary" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .include(".pack-opening")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("V2 tolerates unavailable Canvas and backgrounding without losing the receipt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  const opens = await mount(page, previewPackReceipt("nrl", "LEGENDARY"));
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".cinema-v2")).toHaveAttribute(
    "data-pack-reveal-phase",
    "revealed",
  );
  await expect(page.locator(".cinema-v2 .fantasy-card")).toContainText(
    "Casey Hartwell",
  );
  expect(opens()).toBe(1);
});

test("V2 Share My Pull still exports the awarded Icon at 1080 × 1920", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const opens = await mount(page, previewPackReceipt("afl", "ICON"));
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await page
    .getByRole("button", { name: "Share My Pull", exact: true })
    .click();
  const share = page.getByRole("dialog", { name: "Share your pull" });
  await expect(share.getByRole("button", { name: "Save Image" })).toBeEnabled();
  const image = share.getByRole("img", { name: /Taylor North/ });
  expect(
    await image.evaluate((el: HTMLImageElement) => [
      el.naturalWidth,
      el.naturalHeight,
    ]),
  ).toEqual([1080, 1920]);
  const downloaded = page.waitForEvent("download");
  await share.getByRole("button", { name: "Save Image" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.png$/);
  expect(opens()).toBe(1);
});

test("V2 low-power quality keeps the card and caps the Canvas resolution", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "hardwareConcurrency", {
      value: 2,
      configurable: true,
    }),
  );
  await mount(page, previewPackReceipt("afl", "LEGENDARY"));
  const scene = page.locator(".cinema-v2");
  await expect(scene).toHaveAttribute("data-vfx-quality", "balanced");
  expect(
    await scene.evaluate(
      (el) => el.querySelector("canvas")!.width <= el.clientWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Reveal card", exact: true }).click();
  await expect(scene).toHaveAttribute("data-pack-reveal-phase", "revealed", {
    timeout: 6000,
  });
  await expect(scene.locator(".fantasy-card")).toContainText("Casey Hartwell");
});

test("V2 original layered audio renders both distinct scores without clipping", async ({
  page,
}) => {
  await page.setContent(
    "<!doctype html><html lang='en'><title>Offline audio acceptance</title></html>",
  );
  await page.addScriptTag({
    content: await bundleCommunityFixture("tests/fixtures/cinema-audio.ts"),
  });
  const measured = await page.evaluate(async () => {
    const results = [];
    for (const tier of ["LEGENDARY", "ICON"] as const) {
      const context = new OfflineAudioContext(1, 44100 * 6, 44100);
      const duration = (
        window as unknown as {
          cinemaAudio: (c: BaseAudioContext, t: "LEGENDARY" | "ICON") => number;
        }
      ).cinemaAudio(context, tier);
      const buffer = await context.startRendering();
      const samples = buffer.getChannelData(0);
      let peak = 0,
        energy = 0;
      for (const value of samples) {
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
      }
      results.push({ tier, duration, peak, energy });
    }
    return results;
  });
  for (const result of measured) {
    expect(result.peak).toBeGreaterThan(0.001);
    expect(result.peak).toBeLessThan(1);
    expect(result.energy).toBeGreaterThan(1);
  }
  expect(measured[0].duration).not.toBe(measured[1].duration);
  expect(measured[0].energy).not.toBe(measured[1].energy);
});
