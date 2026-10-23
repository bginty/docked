import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  collectionRarities,
  collectionSports,
  type CollectionCard,
} from "../src/core/owned-collection";
import { rosterCardMetadata } from "../src/core/roster-card-metadata";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../tests/fixtures/marketplace-state";
import { memberTestView } from "../src/core/member-test-wallet";
import roster from "../public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";
async function main() {
  const out = "docs/qa/owned-collection";
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/owned-collection.tsx",
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)"/g,
    ),
  ]
    .map((x) => readFileSync("src/app/" + x[1], "utf8"))
    .join("\n");
  const collections = new Map<string, CollectionCard[]>();
  for (const sport of collectionSports) {
    const players = roster.players.filter((p) => p.sport === sport);
    collections.set(
      sport,
      Array.from({ length: 72 }, (_, i) => {
        const p = players[i % players.length];
        return {
          id: `local-${sport}-${i}`,
          edition_id: `local-edition-${i}`,
          player_id: p?.fixturePlayerId ?? `local-nfl-${i}`,
          name:
            p?.name ??
            ["David Montgomery", "Alvin Kamara", "Keenan Allen"][i % 3],
          team: p?.currentTeam ?? "HOU",
          position: p?.position ?? "RB",
          sport,
          tier: collectionRarities[i % 6],
          season: "ISOLATED TEST",
          serial: i + 1,
          max_supply: 500,
          kind: "regular",
          colour: "",
          shirt: 0,
          status: "active",
          tradeable: false,
          inventory: "beta",
          acquired_at: new Date(100000 + i).toISOString(),
          ...(p
            ? rosterCardMetadata(p.fixturePlayerId, sport, p.currentTeam)
            : { verifiedJerseyNumber: 5 }),
        };
      }),
    );
  }
  const packs = new Map(
    collectionSports.map((s) => {
      const state = marketplaceFixture(Date.now(), marketActors, false, s);
      const view = memberTestView(
        state,
        marketActors[0].id,
        marketLabels,
        false,
        Date.now(),
        [],
        { catalogue: false },
      );
      return [s, { ...view, member: "local-owner" }];
    }),
  );
  let failure = 0,
    revision = 1,
    empty = false;
  const requests: { url: string; bytes: number }[] = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost"),
      path = url.pathname;
    res.setHeader("Cache-Control", "no-store");
    const json = (value: unknown, status = 200) => {
      const body = JSON.stringify(value);
      requests.push({ url: req.url!, bytes: Buffer.byteLength(body) });
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(body);
    };
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (path === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (path === "/api/sports-beta")
      return json({ allowed: ["basketball", "afl", "nrl"] });
    if (path === "/api/nba-beta")
      return json({
        state: {
          sport: "basketball",
          user_id: "local-owner",
          cards: Array.from({ length: 600 }, (_, i) => ({
            ...collections.get("basketball")![i % 72],
            id: `baseline-${i}`,
            tier: i < 591 ? "CORE" : "RARE",
            inventory_class: "real-roster-beta-v1",
            inventory_source:
              i < 591 ? "roster-beta-core-v1" : "credits-fixture-v1",
            owner_id: "local-owner",
          })),
          competitions: [],
          drafts: [],
          entries: [],
          configurations: {},
          continuity: { established: {} },
          server_time: new Date().toISOString(),
        },
      });
    if (path === "/api/fantasy/collection") {
      await new Promise((r) => setTimeout(r, 180));
      if (failure)
        return json(
          {
            error:
              failure === 403
                ? "Your account does not have access to this collection."
                : "Your collection could not be loaded. Please retry.",
          },
          failure,
        );
      const sport = url.searchParams.get("sport") ?? "nfl",
        all = empty ? [] : collections.get(sport)!;
      const rarity = url.searchParams.get("rarity"),
        search = (url.searchParams.get("search") ?? "")
          .toLowerCase()
          .replace(/^#0*/, ""),
        team = url.searchParams.get("team"),
        position = url.searchParams.get("position");
      const filtered = all.filter(
        (c) =>
          (!rarity || rarity === "ALL" || c.tier === rarity) &&
          (!search ||
            `${c.name} ${c.team} ${c.serial}`.toLowerCase().includes(search)) &&
          (!team || c.team === team) &&
          (!position || c.position === position),
      );
      const sort = url.searchParams.get("sort");
      filtered.sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
          : sort === "serial"
            ? a.serial - b.serial
            : sort === "rarity"
              ? (collectionRarities as readonly string[]).indexOf(b.tier) -
                  (collectionRarities as readonly string[]).indexOf(a.tier) ||
                a.id.localeCompare(b.id)
              : a.id.localeCompare(b.id),
      );
      const [offset = 0, oldRevision = revision] = (
        url.searchParams.get("cursor") ?? ""
      )
        .split(":")
        .map(Number);
      const changed = !!oldRevision && oldRevision !== revision;
      return json({
        member: "local-owner",
        sport,
        total: all.length,
        filtered: filtered.length,
        counts: Object.fromEntries(
          collectionRarities.map((t) => [
            t,
            all.filter((c) => c.tier === t).length,
          ]),
        ),
        teams: [...new Set(all.map((c) => c.team))],
        positions: [...new Set(all.map((c) => c.position))],
        cards: changed ? [] : filtered.slice(offset, offset + 18),
        revision: String(revision),
        changed,
        next:
          !changed && offset + 18 < filtered.length
            ? `${offset + 18}:${revision}`
            : null,
      });
    }
    if (path === "/api/test-wallet")
      return json({
        state: packs.get(
          (new URL(req.headers.referer ?? "http://localhost").searchParams.get(
            "sport",
          ) ?? "nfl") as (typeof collectionSports)[number],
        ),
      });
    if (path === "/api/fantasy/card-history")
      return json({
        sport: url.searchParams.get("sport"),
        season: "2026",
        seasons: ["2026"],
        averageBase: null,
        bestBase: null,
        played: 0,
        rows: [],
      });
    if (path === "/api/marketplace")
      return json({ state: { inventory: [], tradingEnabled: false } });
    if (path.startsWith("/api/"))
      return json({
        balance: 10000,
        available: 10000,
        member: "local-owner",
        state: { enabled: false },
      });
    if (path.startsWith("/brand/") || path.startsWith("/images/")) {
      const file = resolve("public", "." + path);
      assert(file.startsWith(resolve("public") + sep));
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
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated collection acceptance</title><link rel="stylesheet" href="/fixture.css"><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const checks: unknown[] = [];
  try {
    const baseline = await browser.newPage({
      viewport: { width: 412, height: 915 },
    });
    const baselineSession = await baseline.context().newCDPSession(baseline);
    await baselineSession.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const bstart = Date.now();
    await baseline.goto(origin + "/fantasy/cards?sport=basketball&baseline=1");
    await expect(
      baseline.locator(".sport-card-collection .card-face"),
    ).toHaveCount(36);
    checks.push({
      baselineUsableMs: Date.now() - bstart,
      baselineRendered: 36,
      baselineData: requests.find((r) => r.url.startsWith("/api/nba-beta")),
    });
    await baseline.screenshot({
      path: out + "/before-412.png",
      fullPage: false,
    });
    await baseline.close();
    for (const width of [412, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 915 } }),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const session = await page.context().newCDPSession(page);
      if (width === 412)
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      for (const sport of collectionSports) {
        const start = Date.now();
        await page.goto(origin + `/fantasy/cards?sport=${sport}`);
        await expect(
          page.locator('.owned-grid .card-face[role="button"]'),
        ).toHaveCount(18);
        const usable = Date.now() - start;
        await expect(
          page.getByText("72 owned cards", { exact: true }),
        ).toBeVisible();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
        const boxes = await page.locator(".owned-tile").evaluateAll((nodes) =>
          nodes.slice(0, 4).map((n) => ({
            x: n.getBoundingClientRect().x,
            y: n.getBoundingClientRect().y,
            width: n.getBoundingClientRect().width,
          })),
        );
        if (width === 412) {
          assert.equal(boxes[0].y, boxes[1].y);
          assert(boxes[2].y > boxes[0].y);
          assert(boxes[0].width > 140);
        }
        await page.screenshot({
          path: `${out}/${sport}-${width}.png`,
          fullPage: false,
        });
        const count = () =>
          requests.filter((r) => r.url.startsWith("/api/fantasy/collection"))
            .length;
        const before = count();
        await page
          .getByRole("button", { name: "Open collection filters" })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("button", { name: "Show cards" }).click();
        assert.equal(count(), before, "Opening filters must not refetch");
        const original = await page
          .locator(".owned-tile")
          .evaluateAll((n) => n.map((x) => x.getAttribute("data-card-id")));
        await page.getByRole("button", { name: "Next cards" }).click();
        await expect(page.locator(".owned-pagination")).toContainText("19–36");
        const next = await page
          .locator(".owned-tile")
          .evaluateAll((n) => n.map((x) => x.getAttribute("data-card-id")));
        assert(next.every((id) => !original.includes(id)));
        await page
          .getByRole("button", { name: "Previous", exact: true })
          .click();
        await expect(page.locator(".owned-pagination")).toContainText("1–18");
        await page
          .getByRole("button", { name: "Legendary 12", exact: true })
          .click();
        await expect(
          page.locator('.owned-grid .card-face[role="button"]'),
        ).toHaveCount(12);
        await expect(
          page.getByText("72 owned cards", { exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "All 72", exact: true }).click();
        await expect(
          page.locator('.owned-grid .card-face[role="button"]'),
        ).toHaveCount(18);
        await page.locator(".owned-grid .card-face").first().click();
        await expect(page.locator(".collectible-viewer")).toBeVisible();
        await page.locator(".collectible-flip-control").click();
        await expect(page.locator(".collectible-flip")).toHaveAttribute(
          "data-side",
          "back",
        );
        await page.getByRole("button", { name: "Close panel" }).click();
        const filters = count();
        await page
          .getByRole("searchbox", { name: "Search your cards" })
          .fill("unmatched fictional search");
        await expect(
          page.getByText("No matching cards", { exact: true }),
        ).toBeVisible();
        assert(count() - filters <= 2, "Debounced search");
        await page
          .getByRole("button", { name: "Reset filters" })
          .first()
          .click();
        await expect(
          page.locator('.owned-grid .card-face[role="button"]'),
        ).toHaveCount(18);
        await page.getByRole("button", { name: "Packs", exact: true }).click();
        await expect(page.locator(".pack-shop")).toBeVisible();
        await page
          .getByRole("button", { name: "My Cards", exact: true })
          .click();
        await expect(
          page.locator('.owned-grid .card-face[role="button"]'),
        ).toHaveCount(18);
        checks.push({
          sport,
          width,
          usableMs: usable,
          renderedCards: 18,
          apiBytes: requests.filter(
            (r) =>
              r.url.startsWith("/api/fantasy/collection?") &&
              r.url.includes(`sport=${sport}`),
          )[0]?.bytes,
          boxes,
        });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
    });
    empty = true;
    await page.goto(origin + "/fantasy/cards?sport=nfl");
    await expect(
      page.getByText("Your collection starts here", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Explore packs", exact: true })
      .click();
    await expect(page.locator(".pack-shop")).toBeVisible();
    await page.getByRole("button", { name: "My Cards", exact: true }).click();
    empty = false;
    failure = 503;
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("could not be loaded");
    failure = 0;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      page.locator('.owned-grid .card-face[role="button"]'),
    ).toHaveCount(18);
    await page.reload();
    await expect(
      page.locator('.owned-grid .card-face[role="button"]'),
    ).toHaveCount(18);
    const transferred = collections.get("nfl")!.shift()!;
    revision++;
    await page.evaluate(() =>
      window.dispatchEvent(new Event("docked-market-changed")),
    );
    await expect(
      page.getByText("71 owned cards", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(`[data-card-id="${transferred.id}"]`),
    ).toHaveCount(0);
    await page
      .locator(".owned-sports")
      .getByRole("button", { name: "NBA", exact: true })
      .click();
    await expect(
      page.locator('.owned-grid .card-face[role="button"]'),
    ).toHaveCount(18);
    await page
      .locator(".owned-sports")
      .getByRole("button", { name: "NFL", exact: true })
      .click();
    await expect(
      page.getByText("71 owned cards", { exact: true }),
    ).toBeVisible();
    const switchStart = Date.now();
    await page
      .locator(".owned-sports")
      .getByRole("button", { name: "NBA", exact: true })
      .click();
    await expect(
      page.locator('[data-card-id^="local-basketball-"]').first(),
    ).toBeVisible();
    checks.push({
      cachedSportVisibleMs: Date.now() - switchStart,
      transferredCardRemoved: true,
    });
    await expect(
      page.locator('.owned-grid .card-face[role="button"]'),
    ).toHaveCount(18);
    revision++;
    await page.getByRole("button", { name: "Next cards" }).click();
    await expect(
      page.getByText("Your collection changed. Showing the latest cards.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".owned-pagination")).toContainText("1–18");
    failure = 403;
    await page.evaluate(() =>
      window.dispatchEvent(new Event("docked-market-changed")),
    );
    await expect(page.getByRole("alert")).toContainText("does not have access");
    await expect(page.locator(".owned-tile")).toHaveCount(0);
    failure = 0;
    checks.push({
      empty: true,
      retry: true,
      ownershipRevisionReset: true,
      revokedAccessClearsCache: true,
    });
    await page.close();
    writeFileSync(
      out + "/browser.json",
      JSON.stringify(
        {
          passed: true,
          scope:
            "Isolated React + HTTP fixture; not authenticated Production. 180ms simulated collection response delay; mobile 4x CPU throttle; desktop unthrottled.",
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
