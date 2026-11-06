import { test, expect } from "@playwright/test";
import { revealPhase } from "../fixtures/pack-browser";

test("the compositor turns forward once and backgrounding completes only the active card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 740 });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  const base =
    process.env.DOCKED_LOCAL_VISUAL_ORIGIN ?? "http://127.0.0.1:3023";
  await page.goto(base + "/preview/rarity-frames");
  await page.getByRole("button", { name: "Preview six-card reveal" }).click();
  const phase = page.locator(revealPhase);
  await page
    .getByRole("button", { name: "Reveal card" })
    .click({ force: true });
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "flipping");
  await expect(phase.locator(".fantasy-card")).toHaveCount(0);

  const samples = await phase
    .locator(".pack-reveal-object")
    .evaluate((element) => {
      const animation = element.getAnimations()[0];
      const duration = Number(animation.effect!.getComputedTiming().duration);
      animation.pause();
      const samples = [0, 0.15, 0.35, 0.5, 0.75, 1].map((fraction) => {
        animation.currentTime = duration * fraction;
        return new DOMMatrixReadOnly(getComputedStyle(element).transform).m11;
      });
      animation.finish();
      return samples;
    });
  expect(samples[0]).toBeCloseTo(1, 4);
  expect(samples.at(-1)).toBeCloseTo(-1, 4);
  for (let i = 1; i < samples.length; i++) {
    expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
  }
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "revealed");
  await expect(phase.locator(".fantasy-card")).toBeVisible();
  await page.getByRole("button", { name: "Reveal next card" }).click();
  await expect(phase).toHaveAttribute("data-reveal-index", "1");
  await page
    .getByRole("button", { name: "Reveal card" })
    .click({ force: true });
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "rarity");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "revealed");
  await expect(phase).toHaveAttribute("data-reveal-index", "1");
  await expect(phase.locator(".fantasy-card")).toBeVisible();
  await page.getByRole("button", { name: "Reveal All" }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(6);
});
