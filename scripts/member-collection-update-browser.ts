import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const out = "docs/qa/member-collection-update";
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/member-collection-update.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((x) => readFileSync("src/app/" + x[1], "utf8"))
    .join("\n");
  let fail = false,
    delay = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://localhost"),
      p = url.pathname;
    res.setHeader("Cache-Control", "no-store");
    if (p === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (p === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (p.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      if (p === "/api/sports-beta")
        return res.end(JSON.stringify({ allowed: ["afl", "nrl"] }));
      if (p === "/api/profile/collection-record") {
        if (fail) {
          res.statusCode = 503;
          return res.end("{}");
        }
        const sport = url.searchParams.get("sport"),
          total = sport === "afl" ? 18 : sport === "nrl" ? 7 : 4;
        return setTimeout(
          () =>
            res.end(
              JSON.stringify({
                member: "local-member",
                sport,
                total,
                counts:
                  sport === "afl"
                    ? { ULTRA_RARE: 16, LEGENDARY: 2 }
                    : { RARE: total },
                entries: 2,
                opened: 3,
                revision: "local",
              }),
            ),
          sport === "afl" ? delay : 0,
        );
      }
      if (p === "/api/fantasy/card-history")
        return res.end(
          JSON.stringify({
            season: "2026",
            seasons: ["2026"],
            played: 0,
            rows: [],
            averageBase: null,
            bestBase: null,
          }),
        );
      return res.end("{}");
    }
    if (p.startsWith("/brand/") || p.startsWith("/images/")) {
      const file = resolve("public", "." + p);
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          p.endsWith("svg")
            ? "image/svg+xml"
            : p.endsWith("webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    browser = await chromium.launch({ channel: "msedge" });
  const checks: unknown[] = [];
  try {
    for (const width of [320, 375, 390, 430, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 950 },
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/profile?sport=afl");
      await expect(
        page.locator(".profile-record-stats strong").first(),
      ).toHaveText("18");
      await expect(page.locator(".profile-record-stats")).toContainText(
        "Packs opened",
      );
      await expect(page.locator(".rarity-counts")).toContainText("16");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        "Profile overflow",
      );
      const height = await page
        .locator(".profile-record-stats")
        .evaluate((e) => e.getBoundingClientRect().height);
      assert.ok(height < 240, `Compact statistics: ${height}`);
      await page.screenshot({
        path: `${out}/profile-${width}.png`,
        fullPage: true,
      });
      await expect(
        page.getByRole("link", { name: "AFL Pack History" }),
      ).toHaveAttribute("href", /sport=afl.*packs=history/);
      await page.getByRole("button", { name: "NRL", exact: true }).click();
      await expect(
        page.locator(".profile-record-stats strong").first(),
      ).toHaveText("7");
      fail = true;
      await page.evaluate(() => dispatchEvent(new Event("docked-app-resume")));
      await expect(page.getByRole("alert")).toContainText(
        "could not be loaded",
      );
      await expect(page.locator(".profile-record-stats")).toHaveCount(0);
      fail = false;
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(
        page.locator(".profile-record-stats strong").first(),
      ).toHaveText("7");
      delay = 500;
      await page.getByRole("button", { name: "AFL", exact: true }).click();
      await page.getByRole("button", { name: "NRL", exact: true }).click();
      await page.waitForTimeout(600);
      await expect(
        page.locator(".profile-record-stats strong").first(),
      ).toHaveText("7");
      delay = 0;
      await page.evaluate(
        "Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}})",
      );
      await page.getByRole("button", { name: "Copy email" }).click();
      await expect(
        page.locator(".profile-support [role=status]"),
      ).toContainText("Could not copy");
      await page.evaluate(
        "Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}})",
      );
      await page.getByRole("button", { name: "Copy email" }).click();
      await expect(page.locator(".profile-support [role=status]")).toHaveText(
        "Email address copied.",
      );
      assert.deepEqual(errors, []);
      checks.push({
        width,
        summary: true,
        retry: true,
        staleResponseBlocked: true,
        clipboard: true,
        noOverflow: true,
      });
      await page.close();
    }
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await page.goto(origin + "/?view=jerseys&sport=afl");
    await expect(page.locator("[data-team] svg")).toHaveCount(18);
    await expect(
      page.locator("[data-team] [data-afl-template=angular]"),
    ).toHaveCount(6);
    await expect(
      page.locator("[data-team] [data-afl-template=horizontal]"),
    ).toHaveCount(12);
    await expect(page.locator("[data-team=ADE] text")).toHaveText("7");
    await expect(page.locator("[data-team=WBD] text")).toHaveCount(0);
    await page
      .locator("[data-team]")
      .first()
      .locator("..")
      .screenshot({ path: `${out}/afl-all-18.png` });
    await page.screenshot({
      path: `${out}/afl-six-rarities.png`,
      fullPage: true,
    });
    for (let i = 0; i < 6; i++)
      await expect(
        page.locator(".collectible-face").nth(i).locator(".rarity-badge-value"),
      ).toHaveCount(1);
    await page.locator(".card-face").first().click();
    await page.locator(".collectible-flip-control").click();
    await expect(page.locator(".collectible-flip")).toHaveAttribute(
      "data-side",
      "back",
    );
    await page.screenshot({ path: `${out}/afl-card-back.png` });
    await page.close();
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          scope:
            "Local actual React components, synthetic summary/API fixtures. No hosted authentication or production mutations.",
          checks,
          jerseyMappings: 18,
          angular: 6,
          horizontal: 12,
          rarities: 6,
          cardFlip: true,
        },
        null,
        2,
      ),
    );
    console.log(
      "Profile at five widths; errors, sport races, clipboard; 18 jerseys and six badges passed.",
    );
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
