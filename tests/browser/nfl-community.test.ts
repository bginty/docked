import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { evidenceRoot } from "./evidence";

declare global {
  interface Window {
    renderNflFixture: (view: string, preview?: boolean) => void;
  }
}
let bundle = "";
test.beforeAll(async () => {
  bundle = await bundleCommunityFixture("tests/fixtures/nfl-community.tsx");
  await mkdir(path.join(evidenceRoot, "nfl"), { recursive: true });
});
for (const width of [320, 412, 1366])
  test(`NFL filters, composition and five-tab beta navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 915 });
    const errors: string[] = [];
    const posts: Record<string, unknown>[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/nfl-fixture")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><title>NFL isolated fixture</title></head><body><main id="fixture-root"></main></body></html>',
        });
      if (
        url.pathname === "/api/community" &&
        route.request().method() === "POST"
      ) {
        posts.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true, id: "authored-post-only" } });
      }
      if (url.pathname.startsWith("/api/")) {
        errors.push(`Unexpected API request ${url.pathname}`);
        return route.abort();
      }
      const root = path.resolve("public");
      const file = path.resolve(root, `.${url.pathname}`);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        return route.fulfill({
          body: await readFile(file),
          contentType: file.endsWith(".png")
            ? "image/png"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "font/woff2",
        });
      } catch {
        return route.abort();
      }
    });
    await page.goto("https://nfl.example.invalid/nfl-fixture");
    for (const css of [
      "brand-theme.css",
      "globals.css",
      "community-app.css",
      "native.css",
      "mobile-app.css",
      "phase5-edges.css",
      "fantasy.css",
      "sports/sport-page.css",
    ])
      await page.addStyleTag({ path: path.resolve("src/app", css) });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => window.renderNflFixture("directory"));
    const nav = page.getByRole("navigation", {
      name: width < 1000 ? "Mobile app navigation" : "App navigation",
      exact: true,
    });
    await expect(nav.locator("a")).toHaveText([
      "Edges",
      "Feed",
      "Following",
      "Points",
      "My Edge",
    ]);
    await expect(
      page.getByLabel("Fantasy cards and rewards", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('[aria-labelledby="nfl-directory-title"] li'),
    ).toHaveCount(32);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth + 1
        ? []
        : [...document.querySelectorAll("body *")]
            .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
            .map((el) => ({
              tag: el.tagName,
              class: el.className,
              right: el.getBoundingClientRect().right,
            }))
            .slice(0, 12),
    );
    expect(overflow).toEqual([]);
    await page.screenshot({
      path: path.join(
        evidenceRoot,
        "nfl",
        `ISOLATED-nfl-directory-${width}.png`,
      ),
      fullPage: true,
    });
    for (const view of ["feed", "edges", "my-edge"]) {
      await page.evaluate((value) => window.renderNflFixture(value), view);
      const chip = page
        .getByRole("navigation", { name: "Filter by sport", exact: true })
        .getByRole("link", { name: "NFL", exact: true });
      await expect(chip).toHaveAttribute("aria-current", "page");
      await expect(chip).toHaveAttribute(
        "href",
        new RegExp(`^/${view}\\?.*sport=nfl`),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    await page.evaluate(() => window.renderNflFixture("compose"));
    await expect(page.locator('select[name="sport"]')).toHaveValue("nfl");
    await page
      .locator("textarea")
      .first()
      .fill("Authored NFL discussion for UI testing only.");
    await page
      .locator("form")
      .first()
      .evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].sport).toBe("nfl");
    expect(posts[0].kind).toBe("discussion");
    await page.evaluate(() => window.renderNflFixture("directory", true));
    await expect(nav.locator("a")).toHaveText([
      "Play",
      "Cards",
      "Market",
      "Social",
      "Profile",
    ]);
    expect(errors).toEqual([]);
  });
