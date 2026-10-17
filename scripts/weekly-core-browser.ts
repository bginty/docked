import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  packFixture,
  packMember,
  packNow,
} from "../tests/fixtures/pack-economy";
import { memberTestView } from "../src/core/member-test-wallet";
import type { FantasyState } from "../src/core/fantasy";
import type { WeeklyCoreView } from "../src/core/weekly-core";
import { rarities, rarityRule } from "../src/core/card-rarity";
async function main() {
  const out = `docs/qa/weekly-core/browser-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/weekly-profile.tsx",
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
    "standings",
    "pack-shop",
    "card-viewer",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const now = Date.now();
  const cards: FantasyState["cards"] = Array.from({ length: 24 }, (_, i) => ({
    id: randomUUID(),
    edition_id: randomUUID(),
    player_id: randomUUID(),
    owner_id: packMember.id,
    name: ["Alex Northbridge", "Cameron Field", "Jordan Rivers", "Taylor West"][
      i % 4
    ],
    position: ["QB", "RB", "WR", "TE"][i % 4],
    sport: "nfl",
    team: ["PIT", "BUF", "BAL", "GB"][i % 4],
    tier: rarities[i % 6],
    serial: 1,
    max_supply: rarityRule(rarities[i % 6]).lifetimeCap ?? 0,
    season: "2026",
    kind: "regular",
    colour: "#1677FF",
    shirt: 1,
    status: "active",
    tradeable: false,
    listed: false,
    created_at: new Date(now).toISOString(),
    acquired_at: new Date(now).toISOString(),
  }));
  let fantasy: FantasyState = {
    team_name: "Alex Example",
    user_id: packMember.id,
    mode: "production",
    nfl_beta: true,
    credits: 0,
    admin: false,
    fee_bps: 750,
    catalog: null,
    cards,
    packs: [],
    shop: [],
    market: [],
    trades: [],
    competitions: [],
    entries: [],
    results: [],
    ledger: [],
    provenance: [],
    members: [{ id: packMember.id, name: "Alex Example" }],
    replacements: [],
  };
  let weekly: WeeklyCoreView = { enabled: false, serverTime: now, packs: [] };
  const reset = () => {
    weekly = {
      enabled: true,
      member: packMember.id,
      policy: "weekly-core-nfl-v1",
      serverTime: now,
      enrolledAt: new Date(now - 86400000).toISOString(),
      nextIssueAt: new Date(now + 6 * 86400000).toISOString(),
      packs: [
        {
          id: randomUUID(),
          issuedAt: new Date(now - 86400000).toISOString(),
          dueAt: new Date(now - 86400000).toISOString(),
          openedAt: null,
          receipt: null,
        },
      ],
    };
    fantasy = { ...fantasy, cards: [...cards] };
  };
  reset();
  let walletReads = 0,
    opens = 0,
    failBalance = false,
    loseOpen = false,
    spendable = 25000;
  const wallet = () => {
    const view = memberTestView(
      packFixture(),
      packMember.id,
      [],
      false,
      packNow,
    );
    return { ...view, wallet: { ...view.wallet, spendable } };
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Cache-Control", "no-store");
    const json = (value: unknown) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    };
    if (url.pathname === "/fixture-state")
      return json({ fantasy, wallet: wallet() });
    if (url.pathname === "/api/fantasy" && req.method === "GET")
      return json({
        state: {
          ...fantasy,
          starter_receipt: {
            id: "original-starter",
            name: "Starter Pack",
            opened_at: new Date(now - 86400000 * 30).toISOString(),
            cards: cards.slice(0, 7),
          },
        },
      });
    if (url.pathname === "/api/test-wallet") {
      walletReads++;
      if (failBalance) {
        res.statusCode = 503;
        return json({ error: "Isolated outage" });
      }
      return json({ state: wallet() });
    }
    if (url.pathname === "/api/fantasy/card-history")
      return json({
        season: null,
        seasons: [],
        rows: [],
        played: 0,
        averageBase: null,
        bestBase: null,
      });
    if (url.pathname === "/api/marketplace")
      return json({ state: { tradingEnabled: false, inventory: [] } });
    if (url.pathname === "/api/weekly-core") {
      if (req.method === "POST") {
        let raw = "";
        for await (const c of req) raw += c;
        const input = JSON.parse(raw);
        const p = weekly.packs.find((p) => p.id === input.pack);
        if (!p) {
          res.statusCode = 400;
          return json({ error: "Pack unavailable" });
        }
        if (!p.receipt) {
          opens++;
          p.openedAt = new Date(now).toISOString();
          p.receipt = {
            id: p.id,
            name: "Weekly Core Pack",
            opened_at: p.openedAt,
            cards: cards.slice(0, 4).map((c, i) => ({
              ...c,
              id: `weekly-${p.id}-${i}`,
              tier: "CORE",
              max_supply: 0,
              tradeable: false,
              verifiedJerseyNumber: 88,
            })),
          };
          fantasy.cards.push(
            ...p.receipt.cards.map((c) => ({
              ...c,
              owner_id: packMember.id,
              listed: false,
              created_at: p.openedAt!,
              acquired_at: p.openedAt!,
            })),
          );
        }
        if (loseOpen) {
          loseOpen = false;
          res.statusCode = 503;
          return json({
            error:
              "Response interrupted after commit. Retry to retrieve your pack.",
          });
        }
        return json({ state: weekly, receipt: p.receipt });
      }
      return json({ state: weekly });
    }
    if (url.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (url.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (
      url.pathname.startsWith("/brand/") ||
      url.pathname.startsWith("/images/")
    ) {
      const file = resolve("public", "." + url.pathname);
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg")
            ? "image/svg+xml"
            : file.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (url.pathname.startsWith("/api/")) {
      res.statusCode = 403;
      return json({ error: "Isolated fixture" });
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked Profile · isolated QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>`,
    );
  });
  await new Promise<void>((r) =>
    server.listen(process.argv.includes("--serve") ? 3031 : 0, "127.0.0.1", r),
  );
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  if (process.argv.includes("--serve")) {
    console.log(origin + "/fantasy/profile");
    return;
  }
  const browser = await chromium.launch({ channel: "msedge" });
  const results: unknown[] = [];
  try {
    for (const width of [1440, 1024, 412, 360]) {
      reset();
      walletReads = 0;
      opens = 0;
      const context = await browser.newContext({
        viewport: { width, height: 915 },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(origin + "/fantasy/profile");
      await expect(
        page.getByText("1 pack ready to open", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".workspace-balance")).toContainText("25,000");
      assert.equal(
        walletReads,
        1,
        "one shared wallet request despite Profile and header consumers",
      );
      await page.screenshot({
        path: `${out}/profile-ready-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no horizontal overflow",
      );
      assert.equal(
        await page
          .getByText("Replacement eligibility", { exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.getByText("Your Docked record", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.getByText("a••••@example.test", { exact: true }).count(),
        1,
      );
      const violations = (
        await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
      ).violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );
      writeFileSync(
        `${out}/axe-${width}.json`,
        JSON.stringify(violations, null, 2),
      );
      assert.equal(violations.length, 0, "accessibility violations");
      await page
        .getByRole("button", { name: "Open Pack", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.equal(opens, 0, "cancelling sealed view does not mint");
      await page
        .getByRole("button", { name: "Open Pack", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open pack", exact: true })
        .last()
        .click();
      await expect(page.locator(".collectible-face")).toBeVisible();
      assert.equal(opens, 1);
      assert.equal(
        await page.locator(".collectible-art .jersey-number").textContent(),
        "88",
        "weekly reveals retain the same verified number as collection cards",
      );
      await page.screenshot({
        path: `${out}/weekly-reveal-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await expect(
        page.getByText("All your weekly packs are open", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${out}/profile-countdown-${width}.png`,
        fullPage: true,
      });
      await page.goto(origin + "/fantasy/test-wallet?view=packs&packs=history");
      await expect(page.locator(".weekly-history [data-pack-id]")).toHaveCount(
        1,
      );
      await page
        .locator(".weekly-history")
        .getByRole("button", { name: "Replay", exact: true })
        .click();
      await expect(page.locator(".collectible-face")).toBeVisible();
      assert.equal(opens, 1);
      await page
        .getByRole("button", { name: "Skip remaining reveals" })
        .click();
      await page
        .getByRole("button", { name: `View ${cards[0].name}`, exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: /^Front of/ }).click();
      await expect(
        page.getByText("No published player scores yet."),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sell card", exact: true }),
      ).toBeDisabled();
      await page.screenshot({
        path: `${out}/weekly-card-back-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Replay Starter Pack", exact: true })
        .click();
      await expect(page.locator(".collectible-face")).toBeVisible();
      assert.equal(opens, 1, "original Starter replay awards nothing");
      await page
        .getByRole("button", { name: "Skip remaining reveals" })
        .click();
      await page
        .getByRole("button", { name: `View ${cards[0].name}`, exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: /^Front of/ }).click();
      await expect(
        page.getByText("No published player scores yet."),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sell card", exact: true }),
      ).toBeDisabled();
      await page.screenshot({
        path: `${out}/starter-card-back-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      results.push({
        width,
        passed: true,
        sharedWalletReads: 1,
        openingAwards: 1,
        replayAwards: 0,
        accessibility: 0,
      });
      await context.close();
    }
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
    });
    for (const route of [
      "/fantasy/play",
      "/fantasy/cards",
      "/fantasy/market",
      "/fantasy/social",
      "/fantasy/results",
      "/profile/withdrawals",
      "/dashboard",
    ]) {
      await page.goto(origin + route);
      await expect(page.locator(".workspace-balance")).toContainText("25,000");
      await page.locator(".app-topbar").screenshot({
        path: `${out}/header-${route.replaceAll("/", "-")}.png`,
      });
    }
    failBalance = true;
    await page.goto(origin + "/fantasy/profile");
    await expect(page.locator(".workspace-balance")).toContainText(
      "Balance unavailable",
    );
    assert.ok(
      !(await page.locator(".workspace-balance").textContent())!.includes(
        "0 test",
      ),
    );
    failBalance = false;
    spendable = 20000;
    await page.goto(origin + "/fantasy/profile");
    await expect(page.locator(".workspace-balance")).toContainText("20,000");
    await page
      .locator(".app-topbar")
      .screenshot({ path: `${out}/header-reserved-excluded.png` });
    spendable = 25000;
    await page.evaluate(() =>
      window.dispatchEvent(new Event("docked-app-resume")),
    );
    await expect(page.locator(".workspace-balance")).toContainText("25,000");
    assert.equal(
      await page
        .getByRole("button", { name: "Install Docked", exact: true })
        .count(),
      0,
    );
    await page.evaluate(`(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {prompt: async () => {}, userChoice: Promise.resolve({outcome:"dismissed"})});
      window.dispatchEvent(event);
    })()`);
    await expect(
      page.getByRole("button", { name: "Install Docked", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(
      page.getByRole("button", { name: "Install Docked", exact: true }),
    ).toHaveCount(0);
    reset();
    loseOpen = true;
    await page.goto(origin + "/fantasy/profile");
    await page.getByRole("button", { name: "Open Pack", exact: true }).click();
    await page
      .getByRole("button", { name: "Open pack", exact: true })
      .last()
      .click();
    await expect(page.getByRole("alert").last()).toBeVisible();
    await page.getByRole("button", { name: "Open pack", exact: true }).click();
    await expect(page.locator(".collectible-face")).toBeVisible();
    assert.equal(
      opens,
      2,
      "one extra reward after reset; retry does not add another",
    );
    await page.keyboard.press("Escape");
    reset();
    weekly.packs.push({ ...weekly.packs[0], id: randomUUID() });
    await page.goto(origin + "/fantasy/test-wallet?view=packs&packs=mine");
    await expect(
      page.getByText("2 packs ready to open", { exact: true }),
    ).toBeVisible();
    const before = opens;
    await page.getByRole("button", { name: "Open Pack", exact: true }).click();
    await page
      .getByRole("button", { name: "Open pack", exact: true })
      .last()
      .click();
    await expect(page.locator(".collectible-face")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByText("1 pack ready to open", { exact: true }),
    ).toBeVisible();
    assert.equal(opens, before + 1);
    await page.screenshot({
      path: `${out}/my-packs-multiple-412.png`,
      fullPage: true,
    });
    await page.goto(origin + "/fantasy/profile");
    await expect(
      page.getByText("1 pack ready to open", { exact: true }),
    ).toBeVisible();
    await page.evaluate(
      'Date.now = () => 0; window.dispatchEvent(new Event("focus"));',
    );
    await expect(page.locator(".weekly-countdown")).toContainText("6d 0h 0m");
    writeFileSync(
      `${out}/results.json`,
      JSON.stringify(
        {
          passed: true,
          scope:
            "Isolated actual React components, synthetic HTTP fixtures; not physical Samsung or hosted auth",
          results,
        },
        null,
        2,
      ),
    );
    console.log(out);
  } catch (e) {
    writeFileSync(`${out}/failure.txt`, String(e));
    throw e;
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
