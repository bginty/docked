import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { rarities } from "../src/core/card-rarity";
async function main() {
  const out = "docs/qa/card-consistency";
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/card-consistency.tsx",
  );
  const names = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ].map((x) => x[1]);
  const css = names.map((n) => readFileSync("src/app/" + n, "utf8")).join("\n");
  const sale: string = "disabled",
    history: string = "empty";
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://localhost"),
      path = url.pathname;
    res.setHeader("Cache-Control", "no-store");
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (path === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (path === "/api/fantasy/card-history") {
      res.setHeader("Content-Type", "application/json");
      if (history === "error") {
        res.statusCode = 503;
        return res.end("{}");
      }
      return res.end(
        JSON.stringify({
          season: "2026",
          seasons: ["2026", "2025"],
          averageBase: null,
          bestBase: null,
          played: 0,
          rows:
            history === "empty"
              ? []
              : Array.from({ length: 12 }, (_, i) => ({
                  week: 12 - i,
                  base: i === 0 ? null : i === 1 ? 0 : 1800 - i * 20,
                  status: i === 0 ? "Pending" : i === 1 ? "DNP" : "Final",
                  updatedAt: null,
                })),
        }),
      );
    }
    if (path === "/api/marketplace") {
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          state: {
            tradingEnabled: sale !== "disabled",
            inventory:
              sale === "other"
                ? []
                : [
                    {
                      id: "visual-card-5",
                      listed: sale === "listed",
                      tradeable: true,
                      transferReason:
                        sale === "locked" ? "Held by a competition." : "",
                    },
                  ],
          },
        }),
      );
    }
    if (path.startsWith("/brand/") || path.startsWith("/images/")) {
      const file = resolve("public", "." + path);
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          path.endsWith(".svg")
            ? "image/svg+xml"
            : path.endsWith(".webp")
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
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local card viewer</title><link rel="stylesheet" href="/fixture.css"><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const checks: unknown[] = [];
  try {
    if (process.argv.includes("--edges")) {
      for (const sport of ["nfl", "basketball", "afl", "nrl"]) {
        const page = await browser.newPage({ viewport: { width: 360, height: 915 } });
        await page.goto(origin + "/?sport=" + sport + "&edge=long-missing");
        await expect(page.locator(".collectible-face")).toHaveCount(6);
        await expect(page.locator(".collectible-face svg text")).toHaveCount(0);
        const overflow = await page.locator(".collectible-family").evaluateAll(nodes => nodes.some(n => n.scrollWidth > n.clientWidth + 1));
        assert.equal(overflow, false, "Long player name clipped");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.screenshot({ path: out + "/" + sport + "-long-missing-360.png", fullPage: true });
        await page.close();
      }
      writeFileSync(out + "/browser-edges.json", JSON.stringify({ passed: true, sports: ["nfl", "basketball", "afl", "nrl"], scope: "Local synthetic long names and missing numbers, six rarities at 360px" }, null, 2));
      console.log("Four long-name/missing-number journeys passed");
      return;
    }
    for (const width of [412, 1440, 360])
      for (const sport of ["nfl", "basketball", "afl", "nrl"]) {
        const context = await browser.newContext({
          viewport: { width, height: 915 },
          isMobile: width < 600,
          hasTouch: width < 600,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(origin + "/?sport=" + sport);
        await expect(page.locator(".collectible-face")).toHaveCount(6);
        for (let i = 0; i < 6; i++) {
          const face = page.locator(".collectible-face").nth(i);
          await expect(face.locator(".collectible-city")).not.toBeEmpty();
          await expect(face.locator(".rarity-badge-value")).toHaveCount(
            ["afl", "nrl"].includes(sport) ? 0 : 1,
          );
          if (sport === "nrl")
            await expect(face.locator("svg text")).toHaveCount(0);
          else await expect(face.locator("svg text")).toHaveCount(1);
        }
        await page.screenshot({
          path: out + "/" + sport + "-rarities-" + width + ".png",
          fullPage: true,
        });
        for (const tier of rarities) {
          await page
            .locator(
              ".fantasy-grid .tier-" + tier.toLowerCase() + " .card-face",
            )
            .click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await dialog.locator(".collectible-flip-control").click();
          await expect(dialog.locator(".collectible-flip")).toHaveAttribute(
            "data-side",
            "back",
          );
          await expect(
            dialog.locator(".collectible-back .rarity-badge-value"),
          ).toHaveCount(["afl", "nrl"].includes(sport) ? 0 : 1);
          await expect(dialog.getByText("Loading player scores…")).toHaveCount(
            0,
          );
          if (tier === "ULTRA_RARE")
            await page.screenshot({
              path: out + "/" + sport + "-back-" + width + ".png",
            });
          await dialog.locator(".collectible-flip-control").click();
          await expect(dialog.locator(".collectible-flip")).toHaveAttribute(
            "data-side",
            "front",
          );
          await page.keyboard.press("Escape");
        }
        await page.getByRole("button", { name: "Open local reveal" }).click();
        await expect(
          page.getByRole("button", { name: "Skip remaining reveals" }),
        ).toBeVisible();
        await page.screenshot({
          path: out + "/" + sport + "-reveal-" + width + ".png",
        });
        await page
          .getByRole("button", { name: "Skip remaining reveals" })
          .click();
        await expect(page.locator(".pack-summary")).toBeVisible();
        await page.screenshot({
          path: out + "/" + sport + "-pack-summary-" + width + ".png",
          fullPage: true,
        });
        await page.goto(origin + "/?sport=" + sport + "&view=collection");
        if (sport !== "nfl") {
          await expect(
            page.getByRole("navigation", { name: /collection links/ }),
          ).toBeVisible();
          await expect(
            page.locator(".roster-beta-collection .collectible-face"),
          ).toHaveCount(6);
          await page.screenshot({
            path: out + "/" + sport + "-collection-" + width + ".png",
            fullPage: true,
          });
          await page
            .locator(".roster-beta-collection .card-face")
            .first()
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          "Horizontal overflow",
        );
        assert.deepEqual(errors, []);
        checks.push({
          width,
          sport,
          rarities: 6,
          flips: true,
          reveal: true,
          collection: true,
          noOverflow: true,
        });
        await context.close();
      }
    writeFileSync(
      out + "/browser.json",
      JSON.stringify(
        {
          scope:
            "Isolated actual React components; no hosted authentication or purchases",
          checks,
        },
        null,
        2,
      ),
    );
    console.log(checks.length + " sport/viewport journeys passed");
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
