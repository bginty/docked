/** Isolated HTTP fixture: actual customer components and root CSS, synthetic data/core commands. */
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { redemptionFixture } from "../tests/fixtures/redemption-state";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../tests/fixtures/marketplace-state";
import { executeCredits } from "../src/core/credits-sandbox";
import { prepareRedemption } from "../src/server/redemption-adapter";
import { identityCaseView } from "../src/core/manual-identity";
import { sellerQuote } from "../src/core/credits-policy";
import { marketplaceView, marketQuery } from "../src/core/marketplace";
async function main() {
  const before = process.argv.includes("--before");
  const out = before
    ? "docs/qa/member-surfaces/before"
    : "docs/qa/member-surfaces";
  mkdirSync(out, { recursive: true });
  const baseline = (p: string) =>
    execFileSync("git", ["show", "HEAD:" + p], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  const overrides = before
    ? Object.fromEntries(
        [
          "competition-results",
          "competition-switch",
          "prizes-page",
          "pack-artwork",
          "credit-marketplace",
        ].map((n) => [
          resolve("src/components/" + n + ".tsx"),
          baseline("src/components/" + n + ".tsx"),
        ]),
      )
    : {};
  const js = await bundleCommunityFixture(
    "tests/fixtures/member-surfaces.tsx",
    overrides,
  );
  const read = (p: string) => (before ? baseline(p) : readFileSync(p, "utf8"));
  const css = [
    ...read("src/app/layout.tsx").matchAll(/import "\.\/(.+\.css)"/g),
  ]
    .map((x) => read("src/app/" + x[1]))
    .join("\n");
  const f = redemptionFixture(Date.now(), false);
  let identity = f.state;
  const markets = Object.fromEntries(
    (["nfl", "afl", "nrl"] as const).map((s) => {
      let state = marketplaceFixture(Date.now(), marketActors, false, s);
      const own = Object.keys(state.cards).find(
        (id) => state.commerce.cards[id].owner === marketActors[0].id,
      )!;
      state = executeCredits(
        state,
        marketActors[0],
        `listing-${s}`,
        { kind: "list", card: own, price: 1000, preference: "sell" },
        Date.now(),
      ).state;
      const other = Object.keys(state.cards).find(
        (id) => state.commerce.cards[id].owner === marketActors[1].id,
      )!;
      state = executeCredits(
        state,
        marketActors[1],
        `other-${s}`,
        { kind: "list", card: other, price: 1234, preference: "sell" },
        Date.now(),
      ).state;
      return [s, state];
    }),
  );
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://local"),
      p = u.pathname;
    const json = (v: unknown, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(v));
    };
    try {
      if (p === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        return res.end(js);
      }
      if (p === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(css);
      }
      if (p === "/api/identity-verification") {
        const admin = u.searchParams.has("admin"),
          actor = admin ? f.actors.staff : f.actors.member;
        if (req.method === "POST") {
          let raw = "";
          for await (const b of req) raw += b;
          const input = JSON.parse(raw);
          identity = executeCredits(
            identity,
            actor,
            input.request,
            prepareRedemption(
              identity,
              actor,
              input.request,
              { action: "identity-case", case: input.case },
              Date.now(),
              f.vault,
            ),
            Date.now(),
          ).state;
        }
        return json(identityCaseView(identity.redemption, actor, admin));
      }
      if (p === "/api/marketplace/quote")
        return json(sellerQuote(Number(u.searchParams.get("price"))));
      if (p === "/api/marketplace") {
        let sport = u.searchParams.get("sport") ?? "nfl";
        let result: unknown = null;
        if (req.method === "POST") {
          let raw = "";
          for await (const b of req) raw += b;
          const input = JSON.parse(raw);
          sport =
            Object.keys(markets).find(
              (s) => !!markets[s].listings[input.command.listing],
            ) ?? sport;
          u.searchParams.set("sport", sport);
          const next = executeCredits(
            markets[sport],
            marketActors[0],
            input.request,
            input.command,
            Date.now(),
          );
          markets[sport] = next.state;
          result = next.result;
        }
        return json({
          result,
          state: marketplaceView(
            markets[sport],
            marketActors[0].id,
            marketLabels,
            marketQuery.parse(Object.fromEntries(u.searchParams)),
            {
              reserved: [],
              rounds: [],
              tradingEnabled: true,
              offersEnabled: false,
            },
          ),
        });
      }
      if (p === "/api/sports-beta" || p === "/api/fantasy/standings") {
        const sport = u.searchParams.get("sport") ?? "nfl";
        return json(
          p === "/api/fantasy/standings" ||
            u.searchParams.get("view") === "standings"
            ? {
                rounds: ["SALARY_CAP", "OPEN"].map((mode) => ({
                  competitionId: `${sport}-${mode}`,
                  sport,
                  label: "Historical QA round",
                  season: "PRIVATE-TEST-2026",
                  week: 1,
                  mode,
                  series: `${sport}-${mode}`,
                  visible: true,
                  finalised: false,
                  rows: [],
                })),
              }
            : { allowed: ["afl", "nrl"] },
        );
      }
      if (p.startsWith("/api/")) return json({});
      if (p.startsWith("/brand/") || p.startsWith("/images/")) {
        const file = resolve("public", "." + p);
        assert.ok(file.startsWith(resolve("public") + sep));
        res.setHeader(
          "Content-Type",
          p.endsWith("svg")
            ? "image/svg+xml"
            : p.endsWith("webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch (e) {
      json({ error: e instanceof Error ? e.message : "Fixture error" }, 400);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    browser = await chromium.launch({ channel: "msedge" }),
    checks: unknown[] = [];
  try {
    if (before) {
      for (const width of [390, 1440]) {
        const p = await browser.newPage({ viewport: { width, height: 950 } });
        for (const route of ["results", "prizes", "market", "packs"]) {
          await p.goto(origin + "/fantasy/" + route + "?sport=nrl");
          await expect(p.locator("h1").first()).toBeAttached();
          await p.waitForTimeout(200);
          await p.screenshot({
            path: out + "/" + route + "-" + width + ".png",
            fullPage: true,
          });
        }
        await p.close();
      }
      console.log(
        "Baseline screenshots captured from HEAD components and root CSS",
      );
      return;
    }
    for (const width of process.argv.includes("--flows")
      ? []
      : process.argv.includes("--narrow")
        ? [320]
        : [320, 360, 375, 390, 430, 768, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 950 },
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const sport of ["nfl", "afl", "nrl"])
        for (const route of ["results", "prizes", "market"]) {
          await page.goto(`${origin}/fantasy/${route}?sport=${sport}`);
          await expect(page.locator("h1").first()).toBeVisible();
          await page.waitForTimeout(150);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
            `${route}/${sport}/${width} overflow`,
          );
          if (route === "results") {
            const h = await page.locator("h1").first().boundingBox(),
              a = await page.locator(".competition-page-actions").boundingBox();
            assert.ok(
              h && a && a.y >= h.y + h.height,
              `Heading normal flow ${width}`,
            );
          }
          if (route === "prizes" && sport !== "nfl") {
            await expect(page.locator(".upcoming-prize-notice")).toContainText(
              "Upcoming",
            );
            for (const mode of ["Traditional", "All-Star"]) {
              await page
                .getByRole("button", { name: new RegExp(mode) })
                .first()
                .click();
              await expect(page.locator(".prizes-page")).toContainText(
                mode === "Traditional" ? "25,000" : "100,000",
              );
            }
          }
          if (route === "market") {
            const box = await page
              .locator(".market-tile")
              .first()
              .boundingBox();
            assert.ok(box && box.width <= 300, "Bounded listing");
          }
          if ([390, 1440].includes(width))
            await page.screenshot({
              path: `${out}/${route}-${sport}-${width}.png`,
              fullPage: true,
            });
          checks.push({ width, sport, route, noOverflow: true });
        }
      await page.goto(`${origin}/fantasy/prizes?sport=afl`);
      await expect(
        page.getByRole("heading", { name: "Prizes", exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "html {font-size:200%}" });
      await page.evaluate(
        () =>
          new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          ),
      );
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        console.log({
          width,
          items: await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .map((e) => ({
                tag: e.tagName,
                cls: e.className,
                right: e.getBoundingClientRect().right,
                width: e.getBoundingClientRect().width,
                scroll: e.scrollWidth,
                client: e.clientWidth,
              }))
              .filter(
                (e) => e.right > innerWidth + 1 || e.scroll > e.client + 1,
              )
              .slice(0, 20),
          ),
        });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `Enlarged text overflow ${width}`,
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage({
      viewport: { width: 390, height: 950 },
      reducedMotion: "reduce",
    });
    for (const sport of ["nfl", "afl", "nrl"]) {
      await page.goto(
        origin + "/fantasy/market?sport=" + sport + "&tab=listings",
      );
      await page
        .getByRole("button", { name: "Manage listing", exact: true })
        .click();
      await expect(page.locator(".market-fees")).toContainText("950 credits");
      for (const [price, fee] of [
        [1, 0],
        [10, 1],
        [40000, 2000],
        [50000, 2000],
      ]) {
        await page.locator("#market-asking").fill(String(price));
        await expect(
          page.locator(".market-fees > div").nth(1).locator("dd"),
        ).toHaveText(`${fee.toLocaleString("en-US")} credits`);
      }
      await page.locator("#market-asking").fill("1000");
      await expect(page.locator(".market-fees")).toContainText("950 credits");
      await page.screenshot({
        path: `${out}/market-manage-${sport}-390.png`,
        fullPage: true,
      });
      await page.goto(origin + "/fantasy/market?sport=" + sport);
      await page
        .getByRole("button", { name: "Buy card", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Review purchase", exact: true })
        .click();
      await expect(page.getByText("You pay 1,234 credits.")).toBeVisible();
      await page.screenshot({
        path: `${out}/market-review-${sport}-390.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Confirm purchase", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: /Congratulations!|Request confirmed/,
        }),
      ).toBeVisible();
      if (
        await page
          .getByRole("button", { name: "Continue Browsing", exact: true })
          .count()
      )
        await page
          .getByRole("button", { name: "Continue Browsing", exact: true })
          .click();
      await page.getByRole("button", { name: "Activity", exact: true }).click();
      await expect(page.locator(".market-activity")).toContainText("1,234");
      await expect(page.locator(".market-activity")).toContainText("Paid");
      await page.screenshot({
        path: `${out}/market-activity-${sport}-390.png`,
        fullPage: true,
      });
    }
    await page.goto(origin + "/profile/identity-verification");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByLabel("Document type 1", { exact: true })
      .selectOption("licence");
    await page
      .getByLabel("Document type 2", { exact: true })
      .selectOption("passport");
    await page
      .getByRole("button", { name: "Save synthetic documents" })
      .click();
    await expect(page.getByText("Case reference:")).toBeVisible();
    await page.screenshot({
      path: `${out}/identity-documents-390.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(
      page.getByRole("heading", { name: "Under review", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${out}/identity-submitted-390.png`,
      fullPage: true,
    });
    await page.goto(origin + "/admin/identity-verification");
    await expect(page.locator(".identity-review")).toHaveCount(1);
    await page
      .getByRole("button", { name: "View synthetic documents securely" })
      .click();
    await expect(page.getByText("SYNTHETIC EVIDENCE ONLY")).toBeVisible();
    await page.getByLabel("Name matches documents").check();
    await page.getByLabel("Date of birth matches documents").check();
    await page.getByLabel("Documents are readable and valid").check();
    await page
      .getByLabel("Customer-facing reason")
      .fill("Synthetic review complete");
    await page
      .getByRole("button", { name: "Approve verification", exact: true })
      .click();
    await expect(page.locator(".identity-review h2")).toContainText("Verified");
    await page.screenshot({
      path: `${out}/identity-review-390.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + "/fantasy/packs");
    await expect(page.locator(".pack-wrapper")).toHaveCount(21);
    await page.screenshot({
      path: `${out}/pack-families-1440.png`,
      fullPage: true,
    });
    await page.close();
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          scope:
            "Local actual React components/root CSS and isolated core-backed HTTP APIs. Simulated authentication; not hosted acceptance.",
          checks,
          identitySubmitReview: true,
          packVariants: 21,
        },
        null,
        2,
      ),
    );
    console.log(
      `Passed ${checks.length} route/width checks, enlarged text, synthetic identity submission/review, 21 pack variants`,
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
