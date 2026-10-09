import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
const out = "docs/qa/owner-gameplay/screens";
test.skip(
  !existsSync("private-data/owner-gameplay/hosted-state.json"),
  "Requires the isolated hosted QA backend snapshot; never substitutes fabricated values",
);
for (const width of [412, 1440])
  test(`owner QA backend data rendered through all five tabs ${width}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await mkdir(out, { recursive: true });
    const state = JSON.parse(
      await readFile("private-data/owner-gameplay/hosted-state.json", "utf8"),
    );
    const bundle = await bundleCommunityFixture(
      "tests/fixtures/fantasy-acceptance.tsx",
    );
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let fail = false;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/"))
        return route.fulfill({
          status: fail ? 503 : 200,
          json: fail
            ? {
                error: "QA simulated connection failure",
                outcome: "unconfirmed",
              }
            : { state, result: {} },
        });
      if (url.pathname === "/fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><title>Owner QA component review</title></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
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
    await page.goto("https://owner-qa.example.invalid/fixture");
    await page.evaluate((s) => Reflect.set(window, "ownerQaState", s), state);
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
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations.map((v) => v.id),
      ).toEqual([]);
      await page.screenshot({
        path: `${out}/${tab}-${width}.png`,
        fullPage: true,
      });
    }
    await page.evaluate(() => Reflect.get(window, "renderFantasy")("cards"));
    await page
      .getByRole("button", { name: /card details/i })
      .first()
      .click();
    await page.screenshot({
      path: `${out}/details-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => Reflect.get(window, "renderFantasy")("profile"));
    const refresh = page.getByRole("button", { name: /refresh/i }).first();
    if (await refresh.count()) {
      fail = true;
      await refresh.click();
      await expect(
        page.getByText("Could not refresh. Please retry."),
      ).toBeVisible();
      await page.screenshot({
        path: `${out}/error-${width}.png`,
        fullPage: true,
      });
      fail = false;
      await refresh.click();
      await expect(page.getByText("Updated from the server.")).toBeVisible();
      await page.screenshot({
        path: `${out}/success-${width}.png`,
        fullPage: true,
      });
    }
    await page.evaluate(() =>
      Reflect.get(window, "renderFantasy")("cards", true),
    );
    await page.screenshot({
      path: `${out}/empty-projection-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
