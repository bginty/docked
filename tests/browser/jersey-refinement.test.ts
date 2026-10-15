import { test, expect } from "@playwright/test";
test("larger original jerseys retain truthful numbers and reachable card interactions", async ({
  page,
}) => {
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  for (const [width, height] of [
    [412, 850],
    [360, 740],
    [850, 412],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:3023/fantasy/play?scenario=entered");
    await expect(page.locator(".seven-slot")).toHaveCount(7);
    await expect(
      page.locator(".seven-slot:first-child .jersey-number"),
    ).toHaveText("8");
    const art = await page
      .locator(".seven-slot:first-child .player-jersey")
      .boundingBox();
    expect(art!.height).toBeGreaterThanOrEqual(106);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/qa/jersey-refinement/final/play-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /^TE1:/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("http://127.0.0.1:3023/fantasy/cards");
    await expect(
      page.locator('.player-jersey[data-number-source="unavailable"] text'),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/qa/jersey-refinement/final/cards-${width}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".fantasy-card")
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  await expect(page.locator(".player-jersey image")).toHaveCount(0);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("http://127.0.0.1:3023/preview/rarity-frames");
  await page.screenshot({path:"docs/qa/jersey-refinement/final/six-rarities.png",fullPage:true});
});
