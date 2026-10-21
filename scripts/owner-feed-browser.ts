import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const js = await bundleCommunityFixture(
    "tests/fixtures/owner-feed-cards.tsx",
  );
  const css = ["brand-theme", "globals", "fantasy", "collectible"]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(js);
      return;
    }
    if (path === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
      return;
    }
    if (path.startsWith("/brand/")) {
      const root = resolve("public"),
        file = resolve(root, "." + path);
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg") ? "image/svg+xml" : "image/webp",
        );
        res.end(readFileSync(file));
      } catch {
        res.writeHead(404).end();
      }
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch(),
    out = "docs/qa/multi-sport/owner-feed";
  mkdirSync(out, { recursive: true });
  const reports = [];
  try {
    for (const width of [360, 412, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 915 },
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      );
      await expect(
        page.locator('[data-card-design="futuristic-v1"]'),
      ).toHaveCount(4);
      for (const [sport, city] of Object.entries({
        afl: "Melbourne",
        nrl: "Sydney",
        basketball: "Boston",
        football: "London",
      })) {
        await expect(
          page.locator(`[data-sport="${sport}"] .collectible-city`),
        ).toHaveText(city);
        await expect(
          page.locator(`[data-sport="${sport}"] .jersey-number`),
        ).toHaveText("7");
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      await page.screenshot({
        path: `${out}/cards-${width}.png`,
        fullPage: true,
      });
      reports.push({
        width,
        canonicalCards: 4,
        cityAndNumberVerified: true,
        overflow: false,
        errors,
      });
      await page.close();
    }
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify({ fixtureOnly: true, reports }, null, 2),
    );
    console.log(JSON.stringify(reports));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
