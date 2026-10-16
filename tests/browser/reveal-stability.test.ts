import { test, expect } from "@playwright/test";

test("delayed compositor finishes once without a timed snap or inspection handoff jump", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 740 });
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  await page.goto((process.env.DOCKED_LOCAL_VISUAL_ORIGIN ?? "http://127.0.0.1:3023") + "/preview/rarity-frames");
  await page.getByRole("button", { name: "Preview six-card reveal" }).click();
  const turn = page.locator(".pack-arrival");
  // A delayed compositor must not be replaced by a front face at 1.8 seconds.
  await turn.evaluate((el) => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
  });
  await page.waitForTimeout(1950);
  await expect(
    page.getByRole("button", { name: "Reveal next card" }),
  ).toBeDisabled();
  const samples = [];
  for (const time of [0, 280, 500, 700, 900, 1100, 1399]) {
    samples.push(
      await turn.evaluate((el, t) => {
        el.getAnimations()[0].currentTime = t;
        return new DOMMatrixReadOnly(getComputedStyle(el).transform).m11;
      }, time),
    );
  }
  expect(samples[0]).toBe(-1);
  for (let i = 1; i < samples.length; i++)
    expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
  const before = await turn.boundingBox();
  await turn.evaluate((el) => el.getAnimations()[0].finish());
  await expect(
    page.getByRole("button", { name: "Reveal next card" }),
  ).toBeEnabled();
  const after = await turn.boundingBox();
  expect(Math.abs(before!.x - after!.x)).toBeLessThan(0.05);
  expect(Math.abs(before!.width - after!.width)).toBeLessThan(0.05);
  expect(await turn.evaluate((el) => el.getAnimations()[0].playState)).toBe(
    "finished",
  );
  await page.waitForTimeout(250);
  expect(
    await turn.evaluate(
      (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).isIdentity,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Reveal next card" }).click();
  await expect(page.locator('[data-reveal-index="1"]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(
    page.getByRole("button", { name: "Reveal next card" }),
  ).toBeEnabled();
  expect(
    await turn.evaluate(
      (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).isIdentity,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Skip remaining reveals" }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(6);
});
