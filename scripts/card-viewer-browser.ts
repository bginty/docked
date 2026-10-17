import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { rarities } from "../src/core/card-rarity";
async function main() {
  const out = "docs/qa/card-viewer";
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture("tests/fixtures/card-viewer.tsx");
  const names = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ].map((x) => x[1]);
  const css = names.map((n) => readFileSync("src/app/" + n, "utf8")).join("\n");
  let sale = "enabled",
    history = "ready";
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
          averageBase: 1680,
          bestBase: 2400,
          played: 5,
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
  const browser = await chromium.launch({ channel: "msedge" }),
    checks: unknown[] = [];
  try {
    for (const width of [1440, 1024, 412, 360]) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
          hasTouch: width < 600,
          isMobile: width < 600,
          reducedMotion: "reduce",
        }),
        page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const tier of rarities) {
        await page.goto(origin + "/?tier=" + tier);
        await page
          .getByRole("button", { name: "Open card", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        if (tier === "CORE") {
          await expect(
            dialog.getByText("Core cards cannot be sold for credits."),
          ).toBeVisible();
          await expect(
            dialog.getByRole("button", { name: "Sell card" }),
          ).toBeDisabled();
        } else
          await expect(
            dialog.getByRole("link", { name: "Sell card" }),
          ).toBeVisible();
        await dialog.screenshot({ path: `${out}/front-${tier}-${width}.png` });
        // Same exact component output for the front, excluding the separate flip control.
        const normalize = (html: string) =>
          html.replace(/_[rR]_[\w]+_|:[rR][\w:]+:/g, "ID");
        assert.ok(
          normalize(await dialog.locator("[data-card-design]").innerHTML()) ===
            normalize(
              await page
                .locator("#unchanged-front [data-card-design]")
                .innerHTML(),
            ),
          "Front markup matches the original component apart from instance SVG IDs",
        );
        const front = await dialog.locator(".collectible-flip").boundingBox();
        await dialog.getByRole("button", { name: /Front of/ }).press("Enter");
        await expect(dialog.locator(".collectible-flip")).toHaveAttribute(
          "data-side",
          "back",
        );
        await expect(
          dialog.getByText("Avg base", { exact: true }),
        ).toBeVisible();
        assert.deepEqual(
          await dialog.locator(".collectible-flip").boundingBox(),
          front,
        );
        await dialog.screenshot({ path: `${out}/back-${tier}-${width}.png` });
        await dialog
          .getByRole("button", { name: "Older", exact: true })
          .click();
        await expect(dialog.locator(".collectible-flip")).toHaveAttribute(
          "data-side",
          "back",
        );
        await dialog.getByRole("button", { name: /Back of/ }).press("Space");
        await expect(dialog.locator(".collectible-flip")).toHaveAttribute(
          "data-side",
          "front",
        );
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Open card", exact: true }),
        ).toBeFocused();
      }
      for (const mode of ["other", "listed", "locked", "disabled"]) {
        sale = mode;
        await page
          .getByRole("button", { name: "Open card", exact: true })
          .click();
        await expect(
          page.getByRole("dialog").getByRole("button", { name: "Sell card" }),
        ).toBeDisabled();
        await page.keyboard.press("Escape");
      }
      sale = "enabled";
      history = "error";
      await page
        .getByRole("button", { name: "Open card", exact: true })
        .click();
      await page.getByRole("button", { name: /Front of/ }).click();
      await expect(page.getByText("Scores unavailable.")).toBeVisible();
      history = "empty";
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(
        page.getByText("No published player scores yet."),
      ).toBeVisible();
      const axe = await new AxeBuilder({ page }).include("dialog").analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({ id: v.id, impact: v.impact })),
        [],
      );
      await page.keyboard.press("Escape");
      history = "ready";
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.mouse.wheel(0, 500);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      assert.deepEqual(errors, []);
      checks.push({
        width,
        rarities: 6,
        keyboard: true,
        escape: true,
        scroll: true,
        disabledSales: true,
        historyRecovery: true,
        axe: 0,
      });
      await context.close();
    }
    writeFileSync(out + "/browser.json", JSON.stringify(checks, null, 2));
    console.log(JSON.stringify(checks));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
