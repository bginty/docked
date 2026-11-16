import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  packFixture,
  packMember,
  packNow as sourcePackNow,
} from "../tests/fixtures/pack-economy";
import { executeCredits } from "../src/core/credits-sandbox";
import {
  memberTestView,
  memberTestSummary,
  testReceipt,
} from "../src/core/member-test-wallet";
import { refreshEconomyCatalogue } from "../src/server/economy-catalogue";
import type { Sql } from "postgres";
import { prepareRosterBetaCatalogue } from "../src/core/roster-beta-prepare";
import { paidPackCatalogueUpgrade } from "../src/core/card-economy";
async function main() {
  const nba = process.argv.includes("--nba");
  const sport = nba
    ? "basketball"
    : process.argv.includes("--afl")
      ? "afl"
      : process.argv.includes("--nrl")
        ? "nrl"
        : "nfl";
  const realRoster = process.argv.includes("--real-rosters");
  const packNow = realRoster ? Date.now() : sourcePackNow;
  const fixture = () => {
    const state = packFixture(sport);
    if (sport === "nfl" && process.argv.includes("--three-sport"))
      paidPackCatalogueUpgrade(state.economy!, packNow);
    if (realRoster) {
      assert.notEqual(sport, "nfl");
      const players = JSON.parse(
        readFileSync(
          "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
          "utf8",
        ),
      ).players;
      state.economy = prepareRosterBetaCatalogue(
        state.economy!,
        players,
        packNow,
      ).economy;
    }
    return state;
  };
  const packPath =
    "/fantasy/test-wallet?view=packs" +
    (sport !== "nfl" ? `&fixtureSport=${sport}&sport=${sport}` : "");
  const out = `docs/qa/batch1-pack-phone-20261116/pack-recovery-browser/${sport}`;
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/pack-shopping.tsx",
  );
  const cardsScript = await bundleCommunityFixture(
    "tests/fixtures/play-standings-visual.tsx",
  );
  // Use the application's actual stylesheet order, including foil and cinema
  // styles. A transport test must not mistake an incomplete fixture for UI QA.
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/(.+\.css)";/g,
    ),
  ]
    .map((match) => readFileSync(`src/app/${match[1]}`, "utf8"))
    .join("\n");
  let state = fixture(),
    calls = 0,
    loseResponse = false,
    rejectPurchase = false;
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/api/nba-beta") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ allowed: sport === "basketball" }));
    }
    if (url.pathname === "/api/sports-beta") {
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({ allowed: sport === "nfl" ? [] : [sport] }),
      );
    }
    if (url.pathname === "/api/test-wallet") {
      res.setHeader("Content-Type", "application/json");
      try {
        // Exercise the same observation refresh as the hosted read/purchase path.
        // All transport and observations remain isolated local fixtures.
        const observations = Object.values(state.economy!.players)
          .filter((p) => p.sport === "nfl")
          .map((p) => ({
            id: p.id,
            team: p.currentTeam,
            position: p.position,
            status: "ACT",
            checked_at: new Date(packNow),
            raw_id: p.sourceRevision,
            verified_jersey_number: p.verifiedJerseyNumber ?? null,
          }));
        await refreshEconomyCatalogue(
          (async () => observations) as unknown as Sql,
          state,
        );
        let result: any = {};
        let entitlement: string | undefined;
        if (req.method === "POST") {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = JSON.parse(raw);
          calls++;
          requests.push(body.request);
          if (rejectPurchase && body.command.kind === "buy-pack") {
            rejectPurchase = false;
            throw Error("Pack unavailable: insufficient eligible supply");
          }
          const next = executeCredits(
            state,
            packMember,
            body.request,
            body.command,
            packNow + calls,
          );
          state = next.state;
          entitlement =
            body.command.kind === "open-pack"
              ? body.command.entitlement
              : (next.result as any).entitlement;
          result =
            body.command.kind === "open-pack"
              ? testReceipt(state, body.command.entitlement, packMember.id)
              : next.result;
          if (loseResponse && body.command.kind === "buy-pack") {
            loseResponse = false;
            res.statusCode = 504;
            return res.end(
              '{"error":"Purchase response unavailable. Reconcile the pending request."}',
            );
          }
        }
        if (url.searchParams.get("result") === "receipt" && entitlement) {
          const view = memberTestView(
            state,
            packMember.id,
            [],
            false,
            packNow + calls,
            [],
            { catalogue: false },
          );
          const pack = view.packs.find((p) => p.id === entitlement)!;
          return res.end(
            JSON.stringify({
              packUpdate: {
                member: view.member,
                wallet: view.wallet,
                pack,
                reconciledCardIds: state.economy!.packs[entitlement].cards,
                cards: view.cards.filter((c) =>
                  pack.receipt?.cards.some((r) => r.id === c.id),
                ),
              },
              result,
            }),
          );
        }
        return res.end(
          JSON.stringify({
            state:
              url.searchParams.get("view") === "summary"
                ? memberTestSummary(state, packMember.id, packNow + calls)
                : memberTestView(
                    state,
                    packMember.id,
                    [],
                    false,
                    packNow + calls,
                    [],
                    { catalogue: false },
                  ),
            result,
          }),
        );
      } catch (e) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({ outcome: "rejected", error: String(e) }),
        );
      }
    }
    if (url.pathname === "/local-identity") {
      res.setHeader("Content-Type", "application/json");
      return res.end('{"member":"visual-member"}');
    }
    if (url.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (url.pathname === "/cards.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(cardsScript);
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
          file.endsWith("svg")
            ? "image/svg+xml"
            : file.endsWith("webp")
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
      res.setHeader("Content-Type", "application/json");
      return res.end('{"error":"Local fixture"}');
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked isolated pack verification</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="${url.pathname === "/fantasy/cards" ? "/cards.js" : "/fixture.js"}"></script></body></html>`,
    );
  });
  await new Promise<void>((r) =>
    server.listen(process.argv.includes("--serve") ? 3026 : 0, "127.0.0.1", r),
  );
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  if (process.argv.includes("--serve")) {
    console.log(origin + "/fantasy/test-wallet?view=packs");
    return;
  }
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await page.goto(origin + packPath);
    rejectPurchase = true;
    await page
      .getByRole("button", { name: "Buy Premium 9 Pack", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Purchase", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "insufficient eligible supply",
    );
    assert.equal(Object.keys(state.economy!.instances).length, 0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    loseResponse = true;
    await page
      .getByRole("button", { name: "Buy Premium 9 Pack", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Purchase", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check pending purchase", exact: true }),
    ).toBeVisible();
    assert.equal(Object.keys(state.economy!.instances).length, 9);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: out + "/pending-390.png" });
    const original = requests[1];
    await page.reload();
    await page
      .getByRole("button", { name: "Retry pending transaction", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    assert.equal(requests[2], original);
    assert.equal(Object.keys(state.economy!.instances).length, 9);
    assert.equal(
      state.journal.filter((j) => j.id === original + "_pack").length,
      1,
    );
    await page
      .getByRole("button", { name: "Reveal card", exact: true })
      .click();
    await expect(
      page.locator(".cinema-v2-front[aria-hidden='false']"),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: out + "/recovered-390.png" });
    const checks = [
      "Conclusive supply rejection does not allocate or debit",
      "Lost committed response leaves nine cards and saved original request",
      "Reload recovers same request, one journal debit and same nine cards",
      "Recovery reaches actual card reveal",
    ];
    writeFileSync(
      out + "/acceptance.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          checks,
          environment:
            "Mobile browser and actual React/components/core; loopback fixture transport",
          productionWrites: 0,
          physicalAndroidTest: false,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
