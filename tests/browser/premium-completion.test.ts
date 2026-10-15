import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3023";
test("premium cards use verified fixture numbers and preserve mobile field interaction", async ({
  page,
}) => {
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  for (const [width, height] of [
    [412, 850],
    [850, 412],
    [360, 740],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + "/fantasy/play?scenario=entered");
    await expect(page.locator(".seven-slot")).toHaveCount(7);
    await expect(
      page.locator(".seven-slot:first-child .jersey-number"),
    ).toHaveText("8");
    await expect(
      page.locator(".seven-slot:first-child .lineup-applied"),
    ).toHaveText("1.0×");
    const background = await page
      .locator(".seven-field")
      .evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(background).toContain("nfl-turf.svg");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: /^TE1:/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({
      path: `docs/qa/premium-completion/play-entered-${width}x${height}.png`,
      fullPage: true,
    });
  }
  await page.goto(origin + "/fantasy/cards");
  await expect(
    page.locator('.player-jersey[data-number-source="unavailable"] text'),
  ).toHaveCount(0);
  await expect(page.locator(".card-shirt svg image")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".fantasy-card")
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
});
