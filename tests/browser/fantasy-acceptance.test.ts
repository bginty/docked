import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
const out = "docs/qa/fantasy-cleanup";
let bundle = "";
test.beforeAll(async () => {
  await mkdir(out, { recursive: true });
  bundle = await bundleCommunityFixture(
    "tests/fixtures/fantasy-acceptance.tsx",
  );
});
for (const width of [360, 412, 1440])
  test(`fantasy journey layout, navigation and honest states at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/"))
        return route.fulfill({
          status: 503,
          json: {
            error: "Authored outage. No transaction was submitted.",
            outcome: "unconfirmed",
          },
        });
      if (url.pathname === "/fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><title>Fantasy design fixture</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
        });
      const root = path.resolve("public"),
        file = path.resolve(root, "." + url.pathname);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        return route.fulfill({
          body: await readFile(file),
          contentType: file.endsWith(".webp")
            ? "image/webp"
            : file.endsWith(".png")
              ? "image/png"
              : "font/woff2",
        });
      } catch {
        return route.abort();
      }
    });
    await page.goto("https://fantasy.example.invalid/fixture");
    for (const name of [
      "brand-theme",
      "globals",
      "community-app",
      "mobile-app",
      "fantasy",
    ])
      await page.addStyleTag({
        content: await readFile("src/app/" + name + ".css", "utf8"),
      });
    await page.addScriptTag({ content: bundle });
    for (const tab of ["play", "cards", "market", "social", "profile"]) {
      await page.evaluate((t) => Reflect.get(window, "renderFantasy")(t), tab);
      await expect(page.locator(".fantasy-heading h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const nav = page.getByRole("navigation", {
        name: width < 768 ? "Mobile app navigation" : "App navigation",
        exact: true,
      });
      await expect(
        nav.getByRole("link", {
          name: {
            play: "Play",
            cards: "Cards",
            market: "Market",
            social: "Social",
            profile: "Profile",
          }[tab],
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page");
      if (width === 412) {
        const a = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          a.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ).toEqual([]);
      }
      await page.screenshot({
        path: `${out}/${tab}-${width}.png`,
        fullPage: true,
      });
    }
    await page.evaluate(() => Reflect.get(window, "renderFantasy")("cards"));
    await page
      .getByRole("button", { name: /detail/i })
      .first()
      .click();
    await page.screenshot({
      path: `${out}/card-detail-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => Reflect.get(window, "renderFantasy")("play"));
    for (const checkbox of await page.locator(".lineup-options input").all())
      await checkbox.check();
    await page.getByRole("button", { name: "Save team & enter" }).click();
    await expect(
      page.getByText("Authored outage. No transaction was submitted."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry pending action" }),
    ).toBeVisible();
    await page.screenshot({
      path: `${out}/team-error-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() =>
      Reflect.get(window, "renderFantasy")("cards", true),
    );
    await expect(page.locator(".fantasy-heading h1")).toBeVisible();
    await page.screenshot({
      path: `${out}/collection-empty-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
