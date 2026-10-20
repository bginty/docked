import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const out = process.argv.includes("--futuristic")
    ? `docs/qa/futuristic-cards/play-regression-${Date.now()}`
    : process.argv.includes("--packs-regression")
      ? "docs/qa/pack-shopping/play"
      : "docs/qa/play-standings";
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/play-standings-visual.tsx",
  );
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
    "standings",
    "pack-shop",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (path === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (path === "/local-identity") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ member: "visual-member" }));
    }
    if (path.startsWith("/brand/") || path.startsWith("/images/")) {
      const file = resolve("public", "." + path);
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          path.endsWith("svg")
            ? "image/svg+xml"
            : path.endsWith("webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (path.startsWith("/api/")) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      return res.end('{"error":"Local visual fixture only"}');
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked LOCAL Play & Standings</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><p style="margin:0;padding:4px 12px;font-size:11px">LOCAL FIXTURE · illustrative teams and scores · no real accounts</p><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) =>
    server.listen(process.argv.includes("--serve") ? 3025 : 0, "127.0.0.1", r),
  );
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  if (process.argv.includes("--serve")) {
    console.log(origin + "/fantasy/play?scenario=entered");
    return;
  }
  const browser = await chromium.launch({ channel: "msedge" });
  const checks: unknown[] = [];
  try {
    for (const width of [1440, 1024, 412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const shot = async (name: string) => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${out}/${name}-${width}.png`,
          fullPage: !name.includes("picker"),
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          name + " page overflow",
        );
      };
      await page.goto(origin + "/fantasy/play?scenario=entered");
      await expect(
        page.getByRole("heading", { name: "Your lineup" }),
      ).toBeVisible();
      await expect(page.getByText("Team name", { exact: true })).toBeVisible();
      await shot("play");
      assert.equal(
        await page
          .locator('.seven-play svg[data-number-source="verified-metadata"]')
          .count(),
        7,
      );
      for (const slot of ["QB1", "RB1", "WR1", "TE1", "FLEX1"]) {
        await page.locator(`[data-slot="${slot}"] .field-player`).click();
        await page
          .getByRole("button", { name: "Replace player", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(
          dialog.getByRole("heading", {
            name: slot === "FLEX1" ? "Choose FLEX" : `Choose ${slot}`,
          }),
        ).toBeVisible();
        const positions = await dialog
          .locator(".collectible-position")
          .allTextContents();
        assert.ok(positions.length);
        assert.ok(
          positions.every((p) =>
            slot === "FLEX1"
              ? ["RB", "WR", "TE"].includes(p)
              : p === slot.replace(/[0-9]/g, ""),
          ),
        );
        assert.equal(
          await dialog.getByLabel("Position", { exact: true }).count(),
          slot === "FLEX1" ? 1 : 0,
        );
        if (slot === "QB1") {
          await shot("picker");
          assert.ok(
            await dialog
              .locator(".candidate-collectible")
              .first()
              .evaluate(
                (el) =>
                  el.querySelector(".collectible-name")!.getBoundingClientRect()
                    .bottom <=
                  el.querySelector(".collectible-city")!.getBoundingClientRect()
                    .top +
                    1,
              ),
            "Long player names do not overlap city",
          );

          await dialog.getByLabel("Search players").fill("no-match");
          await expect(
            dialog.getByText("No cards match your current filters."),
          ).toBeVisible();
          await dialog.getByRole("button", { name: "Clear filters" }).click();
        }
        if (slot === "FLEX1") {
          await dialog
            .getByLabel("Position", { exact: true })
            .selectOption("TE");
          assert.ok(
            (
              await dialog.locator(".collectible-position").allTextContents()
            ).every((p) => p === "TE"),
          );
          await shot("flex-picker");
        }
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      await page.getByRole("button", { name: /All-Star/ }).click();
      await expect(
        page.getByText("No salary cap", { exact: true }).last(),
      ).toBeVisible();
      if (width === 412) {
        await page.goto(origin + "/fantasy/play?scenario=picker-cases");
        await page.locator('[data-slot="QB1"] .field-player').click();
        await page
          .getByRole("button", { name: "Replace player", exact: true })
          .click();
        const picker = page.getByRole("dialog");
        await expect(picker.locator(".picker-results")).toContainText(
          "25 matching cards",
        );
        await expect(picker.locator(".seven-candidate")).toHaveCount(20);
        await picker.getByRole("button", { name: "Next", exact: true }).click();
        await expect(picker.locator(".seven-candidate")).toHaveCount(5);
        await expect(picker.locator(".seven-candidate:disabled")).toHaveCount(
          1,
        );
        await picker
          .getByRole("combobox", { name: /Team/ })
          .selectOption("NYJ");
        await expect(picker.locator(".picker-results")).toContainText(
          "12 matching cards",
        );
        await picker
          .getByRole("combobox", { name: /Rarity/ })
          .selectOption("CORE");
        await expect(
          picker.getByText("No cards match your current filters."),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await page.locator('[data-slot="TE1"] .field-player').click();
        await page
          .getByRole("button", { name: "Replace player", exact: true })
          .click();
        await expect(
          page.getByRole("dialog").locator(".picker-results"),
        ).toContainText("1 matching cards");
        await page.keyboard.press("Escape");
        await page.goto(origin + "/fantasy/play?scenario=empty");
        await page.locator('[data-slot="QB1"] .field-player').click();
        await expect(
          page
            .getByRole("dialog")
            .getByText("No owned cards for this position in this competition."),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      }
      await page.goto(
        origin +
          "/fantasy/results?mode=SALARY_CAP&period=weekly&season=2026&week=2",
      );
      await expect(
        page.getByRole("heading", { name: "Rankings", exact: true }),
      ).toBeVisible();
      await shot("weekly");
      await page.getByRole("button", { name: "Find My Team" }).click();
      await expect(
        page.locator(".standings-table .current-member"),
      ).toContainText("Local Test Team");
      await expect(page.locator(".standings-pagination")).toContainText(
        "Page 3",
      );
      await page
        .locator(".current-member")
        .getByRole("button", { name: "View Lineup" })
        .click();
      await expect(page.getByRole("dialog")).toContainText("Fixture Player 1");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Season", exact: true }).click();
      await expect(page.getByText(/Through Week 2/)).toBeVisible();
      await shot("season");
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Season", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: /All-Star/ }).click();
      await expect(
        page.getByRole("button", { name: /All-Star/ }),
      ).toHaveAttribute("aria-pressed", "true");
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      checks.push({
        width,
        errors,
        axe: axe.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      });
      assert.deepEqual(errors, []);
      await context.close();
    }
  } catch (e) {
    writeFileSync(out + "/browser-failure.txt", String(e));
    throw e;
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
    writeFileSync(
      out + "/browser.json",
      JSON.stringify(
        {
          scope:
            "Interactive production components with isolated synthetic fixtures; not hosted auth or physical Samsung",
          checks,
        },
        null,
        2,
      ),
    );
  }
  assert.ok(
    checks.every((c: any) => c.axe.length === 0),
    "Accessibility findings require review",
  );
  console.log(
    "Play/picker/standings interactive browser checks passed at four viewports",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
