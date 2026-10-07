// Real HTTP sessions against the isolated Preview. No auth or game-rule bypass.
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { totp } from "./fantasy-testers";
import type { FantasyState } from "../src/core/fantasy";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const out = "docs/qa/fantasy";
const checks: string[] = [];
let stage = "scope";
function check(value: unknown, label: string): asserts value {
  stage = label;
  assert.ok(value, label);
  checks.push(label);
}
async function post(c: BrowserContext, route: string, data: unknown) {
  return c.request.post(origin + route, { data, headers: { Origin: origin } });
}
async function state(c: BrowserContext): Promise<FantasyState> {
  const r = await c.request.get(origin + "/api/fantasy");
  assert.equal(r.status(), 200);
  return (await r.json()).state;
}
async function command(
  c: BrowserContext,
  action: string,
  payload: object = {},
  request_id = randomUUID(),
) {
  stage = action;
  const r = await post(c, "/api/fantasy", { action, payload, request_id });
  if (r.status() !== 200) throw Error(`${action} HTTP ${r.status()}`);
  return (await r.json()) as {
    state: FantasyState;
    result: Record<string, string>;
  };
}
async function capture(p: Page, route: string, label: string, width: number) {
  stage = `capture-${label}-${width}`;
  await p.setViewportSize({ width, height: width < 600 ? 900 : 1000 });
  const r = await p.goto(origin + route, { waitUntil: "networkidle" });
  check(r?.status() === 200, `${label}-${width}-HTTP`);
  await p.evaluate(() => document.fonts.ready);
  check(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label}-${width}-no-horizontal-overflow`,
  );
  await p.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
}
async function main() {
  if (process.argv[2] !== "--confirm-preview")
    throw Error("Exact Preview authorization required");
  const receipt = JSON.parse(await readFile(out + "/deployment.json", "utf8"));
  check(
    receipt.origin === origin && receipt.target === "preview",
    "verified-preview-target",
  );
  const j = JSON.parse(
    await readFile("private-data/fantasy/testers.json", "utf8"),
  );
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const contexts: BrowserContext[] = [];
    for (const [i, a] of j.accounts.entries()) {
      const c = await browser.newContext({
        locale: "en-AU",
        timezoneId: "Australia/Sydney",
        viewport: { width: i === 1 ? 390 : 1440, height: 960 },
        isMobile: i === 1,
        hasTouch: i === 1,
      });
      const r = await post(c, "/api/auth", {
        action: "login",
        email: a.email,
        password: a.password,
        app: true,
      });
      check(
        r.status() === 200 && (await r.json()).ok === true,
        `genuine-${a.name}-login`,
      );
      if (i === 2) {
        check(!(await state(c)).admin, "manager-aal1-admin-denied");
        const m = await post(c, "/api/auth", {
          action: "mfa_verify",
          email: a.email,
          factorId: a.factorId,
          code: totp(a.totpSecret),
        });
        check(
          m.status() === 200 && (await m.json()).ok === true,
          "genuine-manager-MFA",
        );
      }
      contexts.push(c);
    }
    const [briant, barry, manager] = contexts;
    const desktop = await briant.newPage(),
      mobile = await briant.newPage(),
      barryPage = await barry.newPage();
    await mobile.setViewportSize({ width: 390, height: 900 });
    const anonymous = await browser.newContext();
    check(
      (await anonymous.request.get(origin + "/api/fantasy")).status() === 403,
      "anonymous-state-denied",
    );
    await capture(await anonymous.newPage(), "/", "homepage", 1440);
    check(
      (
        await post(barry, "/api/fantasy", {
          action: "admin_credit",
          payload: { user_id: j.accounts[1].id, amount: 999 },
          request_id: randomUUID(),
        })
      ).status() === 409,
      "member-credit-forgery-denied",
    );
    for (const [i, c] of contexts.entries()) {
      await command(
        manager,
        "admin_credit",
        { user_id: j.accounts[i].id, amount: 10000 },
        `f0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      );
      let s = await state(c);
      if (!s.packs.some((p) => p.name === "Starter"))
        await command(c, "claim_starter");
      s = await state(c);
      const pack = s.packs.find((p) => p.name === "Starter")!;
      if (i === 0) {
        await mobile.goto(origin + "/fantasy/cards");
        await mobile
          .getByRole("button", {
            name: pack.opened_at ? "View result" : "Open pack",
            exact: true,
          })
          .first()
          .click();
        await mobile.getByRole("region", { name: "Pack reveal" }).waitFor();
        await mobile.screenshot({
          path: out + "/pack-opening-390.png",
          fullPage: true,
        });
      } else await command(c, "open_pack", { pack_id: pack.id });
      check(
        (await state(c)).cards.filter((x) => !x.tradeable).length === 11,
        `starter-valid-eleven-${i}`,
      );
    }
    await capture(desktop, "/fantasy/cards", "collection", 1440);
    check(
      (await desktop.locator(".fantasy-card").count()) >= 11,
      "mobile-open-visible-desktop",
    );
    const locking = Date.now() + 120000;
    const round = await command(manager, "admin_competition", {
      name: "Rookie League · Acceptance",
      season: "2026",
      round: 99,
      locks_at: new Date(locking).toISOString(),
      rules: { duplicates: false },
    });
    const competition_id = round.result.competition_id;
    for (const [i, c] of contexts.entries()) {
      const s = await state(c),
        cards = s.cards.filter((x) => !x.tradeable).map((x) => x.id);
      if (i === 0) {
        await desktop.goto(origin + "/fantasy/play");
        await desktop
          .getByLabel("Competition", { exact: true })
          .selectOption(competition_id);
        const boxes = desktop.locator(".lineup-options input");
        for (let n = 0; n < 11; n++) await boxes.nth(n).check();
        await desktop
          .getByRole("button", { name: "Save team & enter" })
          .click();
        await desktop.getByText("Saved securely.", { exact: true }).waitFor();
      } else await command(c, "save_lineup", { competition_id, cards });
    }
    await mobile.goto(origin + "/fantasy/play");
    await mobile
      .getByLabel("Competition", { exact: true })
      .selectOption(competition_id);
    check(
      (await mobile.locator(".lineup-options input:checked").count()) === 11,
      "desktop-lineup-visible-mobile",
    );
    await capture(desktop, "/fantasy/play", "team-builder", 1440);
    // Tradeable pack outcomes persist across independent simultaneous browser requests.
    const def = (await state(briant)).shop.find((p) => p.name === "Matchday")!;
    const pack = await command(briant, "buy_pack", { definition_id: def.id });
    const opens = await Promise.all([
      command(briant, "open_pack", pack.result),
      command(briant, "open_pack", pack.result),
    ]);
    assert.deepEqual(opens[0].result, opens[1].result);
    checks.push("simultaneous-pack-open-one-persistent-result");
    const c = (await state(briant)).cards.find((c) => c.tradeable)!;
    const listing = await command(briant, "list", {
      card_id: c.id,
      price: 1000,
    });
    const beforeB = (await state(briant)).credits,
      beforeBuyer = (await state(barry)).credits;
    const sale = await command(barry, "buy", listing.result);
    check(sale.state.credits === beforeBuyer - 1000, "mobile-buyer-debited");
    const afterSeller = await state(briant);
    check(
      afterSeller.credits === beforeB + 925 &&
        !afterSeller.cards.some((x) => x.id === c.id),
      "desktop-seller-net-925-and-card-removed",
    );
    check(
      sale.state.cards.some((x) => x.id === c.id) &&
        sale.state.provenance.some(
          (x) => x.card_id === c.id && x.reason === "sale",
        ),
      "mobile-buyer-ownership-and-provenance",
    );
    await barryPage.goto(origin + "/fantasy/cards");
    check(
      (await barryPage.locator(".fantasy-card").count()) >= 12,
      "purchased-card-rendered-mobile",
    );
    const raceCard = afterSeller.cards.find((x) => x.tradeable)!;
    const raceListing = await command(briant, "list", {
      card_id: raceCard.id,
      price: 100,
    });
    const attempts = await Promise.all(
      [barry, manager].map((c) =>
        post(c, "/api/fantasy", {
          action: "buy",
          payload: raceListing.result,
          request_id: randomUUID(),
        }),
      ),
    );
    check(
      attempts.filter((r) => r.status() === 200).length === 1 &&
        attempts.filter((r) => r.status() === 409).length === 1,
      "simultaneous-browser-buy-one-winner",
    );
    const give = (await state(briant)).cards.find((x) => x.tradeable)!;
    const offer = await command(briant, "offer_trade", {
      recipient: j.accounts[1].id,
      give: [give.id],
      receive: [c.id],
    });
    await command(barry, "accept_trade", offer.result);
    check(
      (await state(briant)).cards.some((x) => x.id === c.id) &&
        (await state(barry)).cards.some((x) => x.id === give.id),
      "cross-client-atomic-trade",
    );
    const social = await barry.request.get(
      origin + "/api/community?view=feed&tab=latest",
    );
    const feed = await social.json();
    check(
      social.status() === 200 &&
        JSON.stringify(feed).includes("Fantasy Cards Preview"),
      "shared-social-fantasy-events",
    );
    if (Date.now() < locking + 100)
      await new Promise((r) => setTimeout(r, locking + 100 - Date.now()));
    const denied = await post(briant, "/api/fantasy", {
      action: "save_lineup",
      payload: {
        competition_id,
        cards: (await state(briant)).cards
          .filter((c) => !c.tradeable)
          .map((c) => c.id),
      },
      request_id: randomUUID(),
    });
    check(denied.status() === 409, "cross-client-lineup-lock");
    await command(manager, "admin_simulate", {
      competition_id,
      seed: 20261008,
    });
    const scored = await state(briant);
    check(
      scored.results.filter((r) => r.competition_id === competition_id)
        .length === 3 &&
        scored.results
          .filter((r) => r.competition_id === competition_id)
          .every((r) => r.championship_points > 0),
      "three-user-scores-leaderboard-championship",
    );
    const retired = scored.cards.find((c) => !c.tradeable)!;
    await command(manager, "admin_status", {
      player_id: retired.player_id,
      status: "retired",
    });
    const retained = await state(briant);
    check(
      retained.cards.some(
        (c) => c.id === retired.id && c.status === "retired",
      ) && retained.replacements.some((r) => r.card_id === retired.id),
      "retired-card-preserved-replacement-eligible",
    );
    const replacement = await command(manager, "admin_replacement", {
      card_id: retired.id,
    });
    await command(briant, "open_pack", replacement.result);
    check(
      (await state(briant)).packs.some(
        (p) => p.id === replacement.result.pack_id && p.opened_at,
      ),
      "replacement-pack-opened",
    );
    for (const width of [360, 390, 430, 768, 1440])
      await capture(desktop, "/fantasy/play", "play", width);
    for (const [tab, label] of [
      ["cards", "collection"],
      ["market", "marketplace"],
      ["social", "social"],
      ["profile", "profile"],
    ])
      for (const width of [390, 1440])
        await capture(desktop, "/fantasy/" + tab, label, width);
    const marketCard = (await state(briant)).cards.find(
      (x) => x.tradeable && x.status === "active",
    );
    if (marketCard)
      await command(briant, "list", { card_id: marketCard.id, price: 500 });
    await capture(desktop, "/fantasy/market", "marketplace", 1440);
    await writeFile(
      out + "/acceptance.json",
      JSON.stringify(
        {
          status: "PASS",
          checks,
          browser: "Chromium desktop and mobile emulation",
          actualAndroidTested: false,
          productionChanged: false,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS: ${checks.length} genuine-session Preview checks. Browser emulation only.`,
    );
  } finally {
    await browser.close();
  }
}
main().catch(async (e) => {
  await mkdir(out, { recursive: true });
  await writeFile(
    out + "/acceptance-failure.json",
    JSON.stringify(
      {
        status: "FAIL",
        stage,
        checks,
        error: String(e.message),
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.error(`Acceptance failed at ${stage}; see acceptance-failure.json`);
  process.exitCode = 1;
});
