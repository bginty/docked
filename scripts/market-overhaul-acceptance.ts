// Local-only acceptance, called by the loopback-pinned Auth/Postgres harness.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect, type APIRequestContext } from "@playwright/test";
import type { Sql } from "postgres";
import { privateOfferQuote } from "../src/core/private-card-offers";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import {
  wallet,
  validateCredits,
  type CreditsState,
} from "../src/core/credits-sandbox";
export async function runMarketOverhaul(
  sql: Sql,
  contexts: APIRequestContext[],
  mode: "all" | "finish" | "browser" = "all",
) {
  const checks: string[] = [];
  try {
    const get = async (i: number, path: string) => {
      const r = await contexts[i].get(path);
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    };
    const post = async (i: number, path: string, data: unknown) => {
      const r = await contexts[i].post(path, { data });
      return { status: r.status(), body: await r.json() };
    };
    const market = async (
      i: number,
      command: unknown,
      request: string = randomUUID(),
    ) => {
      const r = await post(i, "/api/marketplace?tab=listings", {
        request,
        command,
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r.body;
    };
    const offer = async (
      i: number,
      command: unknown,
      request: string = randomUUID(),
    ) => post(i, "/api/community", { action: "card_offer", request, command });
    const inventory = async (i: number) =>
      (await get(i, "/api/marketplace?tab=listings")).state.inventory;
    const eligible = async (i: number) =>
      (await inventory(i)).filter((c: any) => !c.listed && !c.transferReason);
    const hubs = await Promise.all(
      [0, 1, 2].map((i) => get(i, "/api/community?view=hub")),
    );
    const members = await Promise.all(
      [0, 1, 2].map(
        async (i) => (await get(i, "/api/test-wallet")).state.member,
      ),
    );
    const state = async () =>
      (await sql`select document from credits_sandbox.state where id`)[0]
        .document as CreditsState;
    if (mode === "all") {
      // Isolated QA setup through the existing journal and pack service, never inventory edits.
      const fixtureStore = new CreditsSandboxStore(sql);
      for (const i of [0, 1, 2]) {
        if ((await eligible(i)).length >= 5) continue;
        const current = await state();
        if (wallet(current, members[i]).spendable < 3000)
          await fixtureStore.execute(
            { id: members[i], role: "reviewer", aal: "aal2" },
            randomUUID(),
            {
              kind: "promotion",
              member: members[i],
              amount: 10000,
              campaign: "market-overhaul-local-" + randomUUID(),
              reason: "Isolated loopback QA fixture; no hosted account",
              confirmed: true,
              redeemable: false,
            },
          );
        const v = (await get(i, "/api/test-wallet")).state;
        const product =
          v.products.find((p: any) => p.type === "STANDARD") ?? v.products[0];
        assert.ok(product, "Permitted local pack product");
        const request = randomUUID();
        const bought = await post(i, "/api/test-wallet", {
          request,
          command: {
            kind: "buy-pack",
            product: product.id,
            configuration: product.version,
            policy: v.policy,
            confirmed: true,
          },
        });
        assert.equal(bought.status, 200, JSON.stringify(bought.body));
        const opened = await post(i, "/api/test-wallet", {
          request: randomUUID(),
          command: { kind: "open-pack", entitlement: request },
        });
        assert.equal(opened.status, 200, JSON.stringify(opened.body));
      }
      const original = await state();
      const issuance = Object.keys(original.cards).sort();
      for (const i of [0, 1, 2]) {
        const cards = Object.fromEntries(
          (await inventory(i)).map((c: any) => [
            c.id,
            {
              enabled: true,
              swaps: true,
              hidden: false,
              minimum: null,
              asking: null,
            },
          ]),
        );
        const p = await post(i, "/api/community", {
          action: "collection_preferences",
          visibility: "members",
          acknowledgeVisibility: true,
          offers: "everyone",
          minimum: null,
          muteOffers: false,
          cards,
        });
        assert.equal(p.status, 200, JSON.stringify(p.body));
      }
      // Public-by-default never overrides existing private choices, including alternate APIs.
      const privacyCard = (await eligible(0))[0];
      assert.ok(
        privacyCard,
        "Seller needs an eligible unlisted isolated fixture card",
      );
      const listing = randomUUID();
      await market(
        0,
        { kind: "list", card: privacyCard.id, preference: "both", price: 1000 },
        listing,
      );
      const prefs = {
        action: "collection_preferences",
        visibility: "members",
        offers: "everyone",
        minimum: null,
        cards: {
          [privacyCard.id]: {
            enabled: true,
            swaps: true,
            hidden: true,
            minimum: null,
            asking: null,
          },
        },
      };
      assert.equal((await post(0, "/api/community", prefs)).status, 200);
      assert.equal(
        (await get(1, "/api/marketplace?listing=" + listing)).state.rows.length,
        0,
      );
      assert.ok(
        !(await get(1, "/api/test-wallet")).state.cards.some(
          (c: any) => c.id === privacyCard.id,
        ),
      );
      assert.ok(
        !(
          await get(1, "/api/community?view=hub&handle=" + hubs[0].handle)
        ).cards.some((c: any) => c.card.id === privacyCard.id),
      );
      assert.notEqual(
        (
          await post(1, "/api/marketplace", {
            request: randomUUID(),
            command: { kind: "review-buy", listing },
          })
        ).status,
        200,
      );
      assert.ok(
        (await get(0, "/api/community?view=hub")).cards.some(
          (c: any) => c.card.id === privacyCard.id,
        ),
      );
      assert.equal(
        (await post(0, "/api/community", { ...prefs, visibility: "private" }))
          .status,
        200,
      );
      assert.equal(
        (await get(1, "/api/community?view=hub&handle=" + hubs[0].handle)).cards
          .length,
        0,
      );
      assert.notEqual(
        (await post(0, "/api/community", { ...prefs, cards: {} })).status,
        200,
        "Existing private collection requires consent",
      );
      assert.equal(
        (
          await post(0, "/api/community", {
            ...prefs,
            acknowledgeVisibility: true,
            cards: {
              [privacyCard.id]: {
                ...prefs.cards[privacyCard.id],
                hidden: false,
              },
            },
          })
        ).status,
        200,
      );
      await market(0, { kind: "cancel-listing", listing });
      checks.push(
        "Global/per-card privacy, owner read, alternate wallet/listing API denial and explicit existing-account consent",
      );
      for (const [mode, seller, buyer, price] of [
        ["sell", 0, 1, 1000],
        ["swap", 0, 2, 0],
        ["both", 2, 1, 100],
      ] as const) {
        const card = (await eligible(seller))[0],
          give = mode === "sell" ? null : (await eligible(buyer))[0];
        assert.ok(card);
        if (mode !== "sell") assert.ok(give);
        const lid = randomUUID();
        await market(
          seller,
          {
            kind: "list",
            card: card.id,
            preference: mode,
            price: mode === "swap" ? 0 : 1000,
          },
          lid,
        );
        const id = randomUUID(),
          proposal = {
            kind: "private-offer",
            card: card.id,
            listing: lid,
            price,
            ...(give ? { offeredCards: [give.id] } : {}),
          };
        const created = await offer(buyer, proposal, id);
        assert.equal(created.status, 200, JSON.stringify(created.body));
        const replay = await offer(buyer, proposal, id);
        assert.equal(replay.status, 200);
        const before = await state();
        const req = randomUUID(),
          accept = { kind: "private-accept", offer: id };
        const outcomes = await Promise.all([
          offer(seller, accept, req),
          offer(seller, accept, req),
        ]);
        assert.ok(
          outcomes.every((r) => r.status === 200),
          JSON.stringify(outcomes),
        );
        const after = await state();
        validateCredits(after);
        assert.equal(after.commerce.cards[card.id].owner, members[buyer]);
        if (give)
          assert.equal(after.commerce.cards[give.id].owner, members[seller]);
        const saved = after.privateCardOffers![id],
          feeEach = saved.feeEach ?? 0;
        assert.equal(
          wallet(after, members[buyer]).spendable,
          wallet(before, members[buyer]).spendable - price - feeEach,
        );
        assert.equal(
          wallet(after, members[seller]).spendable,
          wallet(before, members[seller]).spendable +
            privateOfferQuote(price, feeEach, saved.creditFeeMinimum).net -
            feeEach,
        );
        assert.deepEqual(Object.keys(after.cards).sort(), issuance);
        assert.notEqual(
          (await offer(buyer, accept)).status,
          200,
          "Buyer cannot accept own offer",
        );
        checks.push(
          `${mode}: listing, exact offer, concurrent duplicate acceptance, atomic ownership/credits, unchanged issuance`,
        );
      }
    }
    if (mode !== "browser") {
      // Same card, two offers: serialized acceptance may settle only once.
      const snapshot = await state();
      const open = Object.values(snapshot.privateCardOffers ?? {}).filter(
        (o) =>
          o.status === "OPEN" &&
          o.expires > Date.now() &&
          o.seller === members[1] &&
          [members[0], members[2]].includes(o.buyer) &&
          snapshot.cards[o.card].version === o.version &&
          (!o.requestedListing ||
            snapshot.listings[o.requestedListing]?.status === "OPEN"),
      );
      const paired = open.find((o) =>
        open.some((p) => p.card === o.card && p.buyer !== o.buyer),
      );
      let ids: string[] = [];
      if (paired)
        ids = [members[0], members[2]].map(
          (buyer) =>
            open.find((o) => o.card === paired.card && o.buyer === buyer)!.id,
        );
      else {
        const raceCard = (await eligible(1)).find(
          (c: any) => !open.some((o) => o.card === c.id),
        );
        assert.ok(raceCard);
        const raceListing = randomUUID();
        await market(
          1,
          { kind: "list", card: raceCard.id, price: 1000, preference: "sell" },
          raceListing,
        );
        ids = [randomUUID(), randomUUID()];
        for (const [j, buyer] of [0, 2].entries()) {
          const r = await offer(
            buyer,
            {
              kind: "private-offer",
              card: raceCard.id,
              listing: raceListing,
              price: 1000,
            },
            ids[j],
          );
          assert.equal(r.status, 200, JSON.stringify(r.body));
        }
      }
      const race = await Promise.all(
        ids.map((id) => offer(1, { kind: "private-accept", offer: id })),
      );
      assert.equal(
        race.filter((r) => r.status === 200).length,
        1,
        JSON.stringify(race),
      );
      checks.push(
        "Two buyers racing on separate PostgreSQL connections: exactly one settlement",
      );
      const editCard = (await eligible(0))[0],
        old = randomUUID();
      await market(
        0,
        { kind: "list", card: editCard.id, price: 700, preference: "sell" },
        old,
      );
      const edited = await market(0, {
        kind: "replace-listing",
        listing: old,
        card: editCard.id,
        price: 800,
        preference: "both",
      });
      assert.equal((await state()).listings[old].status, "CANCELLED");
      await market(0, {
        kind: "cancel-listing",
        listing: edited.result.listing,
      });
      checks.push("Edit and cancel preserve immutable original listing terms");
      const denied = await contexts[4].get("/api/marketplace");
      assert.notEqual(denied.status(), 200);
      const owner = await contexts[3].get("/api/marketplace");
      assert.notEqual(owner.status(), 200, "Owner requires MFA");
      checks.push(
        "Unadmitted account denied; owner AAL1 denied; admitted testers work without MFA",
      );
    }
    // Real authenticated browser, using existing local test identities only.
    const browser = await chromium.launch({ headless: true });
    await mkdir("docs/qa/market-overhaul/screenshots", { recursive: true });
    try {
      const bc = await browser.newContext({
        storageState: await contexts[0].storageState(),
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      });
      const page = await bc.newPage();
      page.setDefaultNavigationTimeout(90000);
      page.setDefaultTimeout(30000);
      await page.goto("http://127.0.0.1:3033/fantasy/market?tab=listings");
      await expect(page.getByText("Sell / Swap", { exact: true })).toBeVisible({
        timeout: 60000,
      });
      await expect(
        page.getByRole("button", { name: "Sell / Swap", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.locator(".market-owned-grid button").first(),
      ).toBeVisible({ timeout: 60000 });
      for (const width of [412, 360, 1024, 1440]) {
        await page.setViewportSize({
          width,
          height: width >= 1024 ? 1000 : 915,
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `No overflow at ${width}`,
        );
        await page.screenshot({
          path: `docs/qa/market-overhaul/screenshots/sell-${width}.png`,
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 412, height: 915 });
      const select = page
        .locator(".market-owned-grid button:not([disabled])")
        .first();
      await select.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByLabel("Listing preference").selectOption("both");
      await page.getByLabel("Asking price · test credits").fill("650");
      await page.screenshot({
        path: "docs/qa/market-overhaul/screenshots/listing-412.png",
        fullPage: false,
      });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.notEqual(
        await page.evaluate(() => getComputedStyle(document.body).overflow),
        "hidden",
      );
      const demoCard = (await eligible(1))[0],
        demoListing = randomUUID();
      await market(
        1,
        { kind: "list", card: demoCard.id, price: 650, preference: "both" },
        demoListing,
      );
      try {
        await page.goto(
          `http://127.0.0.1:3033/fantasy/market?tab=browse&listing=${demoListing}`,
        );
        await page
          .getByRole("button", { name: "View card & offers", exact: true })
          .click({ timeout: 60000 });
        await expect(
          page.getByRole("button", { name: "Make offer", exact: true }),
        ).toBeEnabled({ timeout: 60000 });
        await page
          .getByRole("button", { name: "Make offer", exact: true })
          .click();
        const sheet = page.getByRole("dialog", { name: "Make an offer" });
        await expect(sheet).toBeVisible();
        const choice = sheet.getByLabel("Your offered card");
        await expect(choice.locator("option:not([disabled])")).not.toHaveCount(
          1,
          { timeout: 60000 },
        );
        const options = await choice
          .locator("option:not([disabled])")
          .evaluateAll((nodes) =>
            nodes.map((n) => (n as HTMLOptionElement).value).filter(Boolean),
          );
        await choice.selectOption(options[0]);
        await sheet.getByLabel("Credits offered").fill("1000");
        await sheet
          .getByRole("button", { name: "Review offer", exact: true })
          .click();
        await expect(
          sheet.getByRole("button", { name: "Submit offer", exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: "docs/qa/market-overhaul/screenshots/offer-review-412.png",
        });
        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        assert.notEqual(
          await page.evaluate(() => getComputedStyle(document.body).overflow),
          "hidden",
        );
        checks.push(
          "Authenticated card-plus-credit offer review; nested Escape closes both sheets and restores scroll; proposal not submitted",
        );
      } finally {
        await market(1, { kind: "cancel-listing", listing: demoListing });
      }
      await page.goto("http://127.0.0.1:3033/profile?tab=offers");
      await expect(
        page.getByRole("heading", { name: "Offers received & sent" }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        page.getByText("Completed · accepted and settled").first(),
      ).toBeVisible({ timeout: 60000 });
      const pair = page
        .locator(".market-offer-cards")
        .filter({ has: page.getByText("Offered card", { exact: true }) })
        .first();
      const boxes = await pair
        .locator(".social-offer-card")
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            x: n.getBoundingClientRect().x,
            y: n.getBoundingClientRect().y,
          })),
        );
      assert.equal(boxes.length, 2);
      assert.ok(
        Math.abs(boxes[0].y - boxes[1].y) < 2 && boxes[1].x > boxes[0].x,
        "Swap cards aligned side by side",
      );
      await page.screenshot({
        path: "docs/qa/market-overhaul/screenshots/offers-412.png",
        fullPage: true,
      });
      await page.goto("http://127.0.0.1:3033/fantasy/cards");
      await expect(page.getByText("Estimated portfolio value")).toBeVisible({
        timeout: 60000,
      });
      await expect(page.getByText(/of \d+ cards valued/)).toBeVisible({
        timeout: 60000,
      });
      for (const width of [412, 1440]) {
        await page.setViewportSize({ width, height: 915 });
        await page.screenshot({
          path: `docs/qa/market-overhaul/screenshots/portfolio-${width}.png`,
          fullPage: true,
        });
      }
      await bc.close();
      checks.push(
        "Authenticated desktop/tablet/412/360 browser, listing sheet Escape cleanup, offers and portfolio screenshots; physical device not tested",
      );
    } finally {
      await browser.close();
    }
    await writeFile(
      "docs/qa/market-overhaul/http-checks.json",
      JSON.stringify({ checks, at: new Date().toISOString() }, null, 2),
    );
    return checks;
  } catch (error) {
    await writeFile(
      "docs/qa/market-overhaul/acceptance-progress.json",
      JSON.stringify(
        {
          mode,
          passed: false,
          checks,
          error: error instanceof Error ? error.message : "Failed",
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    throw error;
  }
}
