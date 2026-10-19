/** Controlled latency comparison, not a claim about hosted network timings. */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const dir = "docs/qa/team-continuity/navigation-" + Date.now();
  mkdirSync(dir, { recursive: true });
  const entry = "tests/fixtures/navigation-continuity.tsx";
  const js = await bundleCommunityFixture(entry);
  const wallet = "src/components/use-workspace-wallet.ts";
  const beforeJs = await bundleCommunityFixture(entry, {
    [resolve(wallet)]: execFileSync("git", ["show", "bd12aa95:" + wallet], {
      encoding: "utf8",
      windowsHide: true,
    }),
  });
  const css = [
    "brand-theme",
    "globals",
    "sports-visuals",
    "sports-experience",
    "community-app",
    "native",
    "mobile-app",
    "app-auth",
    "beta-experience",
    "fantasy",
    "test-wallet",
    "mobile-cleanup",
    "play-cards",
    "startup-loading",
    "premium-ux",
  ]
    .map((n) => readFileSync("src/app/" + n + ".css", "utf8"))
    .join("\n");
  let walletReads = 0,
    status = 200;
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://local");
    if (u.pathname === "/api/test-wallet") {
      walletReads++;
      await new Promise((r) => setTimeout(r, 250));
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify(
          status === 200
            ? {
                state: {
                  member: "local-only",
                  wallet: { spendable: 12345 },
                  packs: [],
                },
              }
            : { error: "Isolated failure" },
        ),
      );
    }
    if (u.pathname === "/route-data") {
      await new Promise((r) => setTimeout(r, 80));
      return res.end("{}");
    }
    if (u.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(u.searchParams.has("before") ? beforeJs : js);
    }
    if (u.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (u.pathname.startsWith("/brand/") || u.pathname.startsWith("/images/")) {
      const p = resolve("public", "." + u.pathname);
      assert.ok(p.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          p.endsWith(".svg")
            ? "image/svg+xml"
            : p.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(p));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (u.pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      return res.end("{}");
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local navigation test</title><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js${u.searchParams.has("before") ? "?before=1" : ""}"></script></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const browser = await chromium.launch({ channel: "msedge" });
  const results = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
      reducedMotion: "reduce",
    });
    // tsx preserves names for the nested measurement callback serialized by Playwright.
    await page.addInitScript("window.__name = (fn) => fn");
    for (let trial = 1; trial <= 5; trial++) {
      for (const before of [true, false]) {
        await page.goto(origin + "/fantasy/play" + (before ? "?before=1" : ""));
        await expect(page.locator(".workspace-balance strong")).toHaveText(
          "12,345",
        );
        const initialReads = walletReads;
        await page.evaluate(() => {
          Object.assign(window, {
            originalShell: document.querySelector(".community-shell"),
            measurementStart: performance.now(),
            blankFrames: 0,
            lastBlank: 0,
          });
          const track = () => {
            const w = window as unknown as {
              blankFrames: number;
              lastBlank: number;
              measurementStart: number;
              stopMeasurement?: boolean;
            };
            if (!document.querySelector(".workspace-balance strong")) {
              w.blankFrames++;
              w.lastBlank = performance.now() - w.measurementStart;
            }
            if (!w.stopMeasurement) requestAnimationFrame(track);
          };
          requestAnimationFrame(track);
        });
        await page.getByRole("button", { name: "Navigate to Cards" }).click();
        await expect(
          page.getByRole("heading", { name: "Your cards" }),
        ).toBeVisible();
        const routeMs = await page.evaluate(
          () =>
            performance.now() -
            (window as unknown as { measurementStart: number })
              .measurementStart,
        );
        if (!before)
          await expect(page.locator(".workspace-balance strong")).toHaveText(
            "12,345",
          );
        await expect(page.locator(".workspace-balance")).toContainText(
          "test Docked Credits",
        );
        const sample = await page.evaluate(() => {
          const w = window as unknown as {
            originalShell: Element;
            blankFrames: number;
            lastBlank: number;
            stopMeasurement: boolean;
          };
          w.stopMeasurement = true;
          return {
            sameShell:
              w.originalShell === document.querySelector(".community-shell"),
            blankFrames: w.blankFrames,
            balanceBlankMs: Math.round(w.lastBlank),
          };
        });
        results.push({
          trial,
          before,
          routeReadyMs: Math.round(routeMs),
          walletRequests: walletReads - initialReads,
          ...sample,
        });
        assert.equal(sample.sameShell, !before);
        if (!before) assert.equal(sample.blankFrames, 0);
        await page.screenshot({
          path: dir + "/" + (before ? "before" : "after") + "-412.png",
          fullPage: true,
        });
      }
    }
    status = 503;
    await page.evaluate(() =>
      window.dispatchEvent(new Event("docked-app-resume")),
    );
    await expect(page.locator(".workspace-balance")).toContainText(
      "Balance refresh unavailable",
    );
    await expect(page.locator(".workspace-balance strong")).toHaveText(
      "12,345",
    );
    await expect(
      page.getByRole("heading", { name: "Your cards" }),
    ).toBeVisible();
    await page.screenshot({
      path: dir + "/network-failure-retains-content-412.png",
      fullPage: true,
    });
    status = 401;
    await page.evaluate(() =>
      window.dispatchEvent(new Event("docked-app-resume")),
    );
    await expect(page.locator(".workspace-balance strong")).toHaveCount(0);
    status = 200;
    await page.evaluate(() =>
      window.dispatchEvent(new Event("docked-app-resume")),
    );
    await expect(page.locator(".workspace-balance strong")).toHaveText(
      "12,345",
    );
    writeFileSync(
      dir + "/results.json",
      JSON.stringify(
        {
          scope:
            "Real components; local transport with 250ms wallet and 80ms route responses. Baseline uses bd12aa95 wallet and route-bound shell; after uses persistent shell. Not hosted latency.",
          results,
          networkFailureRetention: true,
          unauthenticatedBalanceCleared: true,
          recovery: true,
        },
        null,
        2,
      ),
    );
    console.log(dir, JSON.stringify(results));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
