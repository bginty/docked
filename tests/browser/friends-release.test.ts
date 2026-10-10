import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/friends-release.tsx");
});
for (const width of [360, 412, 1366])
  test(`owner operations, composer and rules at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).pathname === "/release-fixture"
        ? route.fulfill({
            contentType: "text/html",
            body: '<!doctype html><html lang="en"><head><title>Docked release QA</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
          })
        : route.fulfill({ status: 503, json: { error: "Test outage" } }),
    );
    await page.goto("/release-fixture");
    await page.addStyleTag({
      content: [
        "brand-theme",
        "globals",
        "community-app",
        "mobile-app",
        "fantasy",
        "scoring",
      ]
        .map((f) => readFileSync(`src/app/${f}.css`, "utf8"))
        .join("\n"),
    });
    await page.addScriptTag({ content: bundle });
    for (const screen of [
      "dashboard",
      "empty",
      "scoring",
      "composer",
      "packs",
      "prizes",
    ]) {
      await page.evaluate(
        (s) => Reflect.get(window, "renderRelease")(s),
        screen,
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (screen === "dashboard")
        await expect(
          page.getByText("SYNTHETIC QA ONLY", { exact: true }),
        ).toBeVisible();
      if (screen === "scoring")
        await expect(
          page.getByRole("cell", { name: "2", exact: true }).first(),
        ).toBeVisible();
      if (screen === "composer") {
        const input = page.locator("textarea").first();
        await input.fill(
          "A mobile keyboard test with a long but ordinary community update.",
        );
        await expect(input).toBeFocused();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      mkdirSync("docs/qa/friends-release/screens", { recursive: true });
      await page.screenshot({
        path: `docs/qa/friends-release/screens/${screen}-${width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
