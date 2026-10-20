import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../tests/fixtures/marketplace-state";
import { memberTestView } from "../src/core/member-test-wallet";
async function main() {
  const out = "docs/qa/member-cleanup";
  mkdirSync(out, { recursive: true });
  const js = await bundleCommunityFixture("tests/fixtures/member-cleanup.tsx");
  const names = [
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
    "fantasy-play",
    "pack-opening",
    "scoring",
    "test-wallet",
    "marketplace",
    "mobile-cleanup",
    "play-cards",
    "social-hub",
    "collectible",
    "card-viewer",
    "premium-ux",
    "pack-shop",
  ];
  const css = names
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const before = names
    .map((n) =>
      execFileSync("git", ["show", `fddd6ff5:src/app/${n}.css`], {
        encoding: "utf8",
      }),
    )
    .join("\n");
  const state = memberTestView(
    marketplaceFixture(),
    marketActors[0].id,
    marketLabels,
  );
  let starterMode = "empty";
  const server = createServer((req, res) => {
    const u = new URL(req.url!, "http://local");
    if (u.pathname === "/api/test-wallet") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ state }));
      return;
    }
    if (u.pathname === "/fixture-state") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(state));
      return;
    }
    if (u.pathname === "/api/fantasy/starter-history") {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = starterMode === "error" ? 503 : 200;
      res.end(
        JSON.stringify(
          starterMode === "error"
            ? { error: "Isolated unavailable response" }
            : { member: state.member, receipt: null },
        ),
      );
      return;
    }
    if (u.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(js);
      return;
    }
    const file = resolve("public", "." + decodeURIComponent(u.pathname));
    if (file.startsWith(resolve("public") + sep)) {
      try {
        const b = readFileSync(file);
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg")
            ? "image/svg+xml"
            : file.endsWith(".png")
              ? "image/png"
              : file.endsWith(".webp")
                ? "image/webp"
                : "application/octet-stream",
        );
        res.end(b);
        return;
      } catch {}
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked isolated cleanup</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${u.searchParams.has("before") ? before : css} .qa-only{display:none}body{margin:0}</style></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];
  try {
    for (const width of [360, 412, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ["activity", "packs", "wallet"]) {
        for (const old of view === "wallet" ? [false] : [true, false]) {
          await page.goto(`${base}/?view=${view}${old ? "&before=1" : ""}`);
          await page
            .locator(
              view === "wallet"
                ? ".wallet-amount"
                : view === "packs"
                  ? ".pack-history-row"
                  : ".market-activity article",
            )
            .first()
            .waitFor();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(200);
          if (!old) {
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
              ),
              false,
              `${view} overflow ${width}`,
            );
            if (view === "activity") {
              const sizes = await page
                .locator(".compact-collectible-canvas")
                .evaluateAll((es) =>
                  es.map((e) => {
                    const r = e.getBoundingClientRect();
                    return r.width / r.height;
                  }),
                );
              assert.ok(sizes.every((n) => Math.abs(n - 2 / 3) < 0.01));
            }
            if (view === "packs") {
              const sizes = await page
                .locator(".pack-wrapper")
                .evaluateAll((es) =>
                  es.map((e) => {
                    const r = e.getBoundingClientRect();
                    return r.width / r.height;
                  }),
                );
              assert.ok(sizes.every((n) => Math.abs(n - 0.73) < 0.02));
            }
          }
          await page.screenshot({
            path: `${out}/${view}-${old ? "before" : "after"}-${width}.png`,
            fullPage: true,
          });
          if (view === "wallet") {
            await expect(page.locator(".wallet-history")).not.toHaveAttribute(
              "open",
              "",
            );
            await page.locator(".wallet-history > summary").focus();
            await page.keyboard.press("Enter");
            await expect(page.locator(".wallet-history")).toHaveAttribute(
              "open",
              "",
            );
            await expect(page.locator(".wallet-history li")).toHaveCount(
              state.history.length,
            );
            assert.equal(await page.locator(".wallet-shortcuts a").count(), 6);
            await page.screenshot({
              path: `${out}/wallet-expanded-${width}.png`,
              fullPage: true,
            });
            const axe = await new AxeBuilder({ page }).analyze();
            writeFileSync(
              `${out}/axe-wallet-${width}.json`,
              JSON.stringify(axe.violations, null, 2),
            );
            assert.equal(
              axe.violations.filter((v) =>
                ["critical", "serious"].includes(v.impact ?? ""),
              ).length,
              0,
            );
          }
          results.push({ view, width, before: old, pass: true });
        }
      }
    }
    await page.goto(`${base}/?view=starter`);
    await expect(
      page.getByText(/No original Starter Pack receipt/),
    ).toBeVisible();
    starterMode = "error";
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Retry starter history" }),
    ).toBeVisible();
    starterMode = "empty";
    await page.getByRole("button", { name: "Retry starter history" }).click();
    await expect(
      page.getByText(/No original Starter Pack receipt/),
    ).toBeVisible();
    writeFileSync(
      `${out}/browser-results.json`,
      JSON.stringify(
        {
          results,
          starterEmptyErrorRetry: true,
          mutations: "isolated fixtures only",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ out, checks: results.length, starter: true }));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
