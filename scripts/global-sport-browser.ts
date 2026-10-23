import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { globalFeed, profile } from "../tests/fixtures/global-sport-data";
import {
  historicalArchive,
  historicalPage,
  historyQuery,
} from "../src/core/historical-fixtures";
import afl from "../config/history/afl-2026.json";
import nrl from "../config/history/nrl-2026.json";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../tests/fixtures/marketplace-state";
import { memberTestView } from "../src/core/member-test-wallet";
import { marketplaceView, marketQuery } from "../src/core/marketplace";
import type { FixtureSport } from "../src/core/fixture-sports";
async function main() {
  const out = "docs/qa/global-sport";
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/global-sport.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((x) => readFileSync("src/app/" + x[1], "utf8"))
    .join("\n");
  const archives = {
    afl: historicalArchive.parse(afl),
    nrl: historicalArchive.parse(nrl),
  };
  const requests: { url: string; bytes: number }[] = [];
  let joined = false;
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://localhost"),
      p = u.pathname;
    const json = (v: unknown) => {
      const body = JSON.stringify(v);
      requests.push({ url: req.url!, bytes: Buffer.byteLength(body) });
      res.setHeader("Content-Type", "application/json");
      res.end(body);
    };
    if (p === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (p === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (p === "/api/fantasy/match-history") {
      const q = historyQuery.parse(Object.fromEntries(u.searchParams));
      return json(historicalPage(archives[q.sport], q));
    }
    if (p === "/api/community") {
      if (req.method === "POST") {
        let b = "";
        for await (const c of req) b += c;
        const a = JSON.parse(b);
        if (a.action === "community_join") joined = a.enabled;
        return json({ ok: true });
      }
      if (u.searchParams.get("view") === "offers")
        return json({ enabled: false, offers: [], inventory: [], audit: [] });
      if (u.searchParams.get("view") === "hub")
        return json({
          own: true,
          viewer: profile.id,
          handle: profile.handle,
          visibility: "private",
          visible: true,
          cards: [],
          settings: null,
          communities: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Isolated community",
              description: "Test membership",
              rules: "Be respectful",
              joined,
              members: joined ? 1 : 0,
            },
          ],
          canManage: false,
        });
      return json({ ...globalFeed, posts: [], nextCursor: null });
    }
    if (p === "/api/sports-beta" && !u.searchParams.has("sport"))
      return json({ allowed: ["basketball", "afl", "nrl"] });
    if (p === "/api/nba-beta" || p === "/api/sports-beta")
      return json({
        state: {
          sport: u.searchParams.get("sport") ?? "basketball",
          user_id: "local-owner",
          server_time: new Date().toISOString(),
          cards: [],
          configurations: {},
          competitions: [],
          drafts: [],
          entries: [],
          continuity: { established: {}, rollovers: [] },
        },
      });
    if (p === "/api/fantasy/collection")
      return json({
        member: "local-owner",
        sport: u.searchParams.get("sport"),
        total: 0,
        filtered: 0,
        counts: {},
        teams: [],
        positions: [],
        cards: [],
        revision: "1",
        changed: false,
        next: null,
      });
    if (p === "/api/marketplace") {
      const state = marketplaceFixture(
        Date.now(),
        marketActors,
        false,
        (u.searchParams.get("sport") ?? "nfl") as FixtureSport,
      );
      return json({
        state: marketplaceView(
          state,
          marketActors[0].id,
          marketLabels,
          marketQuery.parse(Object.fromEntries(u.searchParams)),
        ),
      });
    }
    if (p === "/api/test-wallet") {
      const s =
        new URL(req.headers.referer ?? "http://localhost").searchParams.get(
          "sport",
        ) ?? "nfl";
      const state = marketplaceFixture(
        Date.now(),
        marketActors,
        false,
        s as FixtureSport,
      );
      return json({
        state: memberTestView(
          state,
          marketActors[0].id,
          marketLabels,
          false,
          Date.now(),
          [],
          { catalogue: false },
        ),
      });
    }
    if (p.startsWith("/api/"))
      return json({
        balance: 10000,
        available: 10000,
        member: "local-owner",
        state: { enabled: false },
      });
    if (p.startsWith("/brand/") || p.startsWith("/images/")) {
      const f = resolve("public", "." + p);
      assert(f.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          p.endsWith(".svg")
            ? "image/svg+xml"
            : p.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(f));
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
    browser = await chromium.launch({ channel: "msedge" }),
    checks: unknown[] = [];
  try {
    for (const width of [412, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 915 } }),
        errors: string[] = [];
      page.on("pageerror", (e) => {
        errors.push(e.message);
        console.error("PAGE ERROR", e.message);
      });
      if (width === 412)
        await (
          await page.context().newCDPSession(page)
        ).send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.goto(origin + "/fantasy/cards?sport=nfl");
      await expect(
        page.getByRole("navigation", { name: "Sport", exact: true }),
      ).toHaveCount(1);
      await page
        .locator(".owned-sports")
        .getByRole("button", { name: "NBA", exact: true })
        .click();
      await expect(
        page
          .locator(".owned-sports")
          .getByRole("button", { name: "NBA", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      const navigation = page.locator(
        width === 412 ? ".app-bottom-nav" : ".app-sidebar",
      );
      for (const tab of ["Market", "Play", "Cards"]) {
        await navigation.getByRole("link", { name: tab, exact: true }).click();
        await expect(
          page
            .locator(".owned-sports")
            .getByRole("button", { name: "NBA", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        assert(page.url().includes("sport=basketball"));
      }
      const documents = await page.evaluate(
        () => performance.getEntriesByType("navigation").length,
      );
      assert.equal(documents, 1);
      await page.screenshot({ path: `${out}/navigation-${width}.png` });
      const before = requests.filter((r) => r.url.includes("view=hub")).length;
      await navigation
        .getByRole("link", { name: "Social", exact: true })
        .click();
      await expect(page.locator(".owned-sports")).toHaveCount(0);
      for (const sport of ["nfl", "basketball", "afl", "nrl"])
        await expect(
          page.getByText(`Isolated ${sport} community discussion`, {
            exact: true,
          }),
        ).toBeVisible();
      assert.equal(
        requests.filter((r) => r.url.includes("view=hub")).length,
        before,
        "No inventory on composer mount",
      );
      await page.getByRole("button", { name: "Load more posts" }).click();
      assert(
        !requests
          .filter((r) => r.url.includes("view=feed"))
          .at(-1)
          ?.url.includes("sport="),
      );
      await page.getByRole("link", { name: "Following", exact: true }).click();
      await expect(
        page.getByText("Isolated afl community discussion", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Attach cards", exact: true })
        .click();
      await expect
        .poll(() => requests.filter((r) => r.url.includes("view=hub")).length)
        .toBeGreaterThan(before);
      await page
        .getByRole("button", { name: "Close panel", exact: true })
        .click();
      await page.screenshot({ path: `${out}/social-${width}.png` });
      await page
        .getByRole("link", { name: "Communities", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Isolated community" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: joined ? "Leave" : "Join", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: joined ? "Leave" : "Join",
          exact: true,
        }),
      ).toBeVisible();
      assert(requests.some((r) => r.url.includes("cards=false")));
      await page
        .getByRole("link", { name: "Start a conversation", exact: true })
        .click();
      await expect(page.locator("#social-compose")).toBeVisible();
      await navigation
        .getByRole("link", { name: "Cards", exact: true })
        .click();
      await expect(
        page
          .locator(".owned-sports")
          .getByRole("button", { name: "NBA", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      for (const sport of ["afl", "nrl"] as const) {
        const started = Date.now();
        await page.goto(origin + `/fantasy/history?sport=${sport}`);
        await expect(page.locator(".historical-match")).toHaveCount(20);
        const usableMs = Date.now() - started;
        const ids = await page.locator(".historical-match").allTextContents();
        await page.getByRole("button", { name: "Next matches" }).click();
        await expect(page.locator(".owned-pagination")).toContainText("Page 2");
        assert.notDeepEqual(
          await page.locator(".historical-match").allTextContents(),
          ids,
        );
        await page
          .getByLabel("Team", { exact: true })
          .selectOption({ index: 1 });
        await expect(page.locator(".owned-pagination")).toContainText("Page 1");
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
        await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${out}/${sport}-history-${width}.png`,
          fullPage: false,
        });
        checks.push({ sport, width, usableMs, pageSize: 20 });
      }
      assert.deepEqual(errors, []);
      checks.push({
        width,
        persistentSport: true,
        noDocumentReload: true,
        socialAcrossSports: true,
        lazyInventory: true,
        communityJoinLeave: true,
      });
      await page.close();
    }
    writeFileSync(
      out + "/browser.json",
      JSON.stringify(
        {
          passed: true,
          scope:
            "Isolated React HTTP fixture, real archive data. Not authenticated Production. Mobile CPU 4x; localhost network.",
          checks,
          requests,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks: checks.length }));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
