import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "postgres";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { pgliteSql } from "../fixtures/pglite-sql";
import { CommercialLedger } from "../../src/server/commercial-ledger";
import { CommercialMemberView } from "../../src/server/commercial-member-view";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
} from "../../src/core/commercial-billing";
import { commercialCard } from "../../src/core/commercial-presentation";
import { rarityRule } from "../../src/core/card-rarity";

test("committed commercial purchase survives failed history and page reload using the same request", async ({
  page,
}) => {
  test.setTimeout(180000);
  // Real commercial migration/repository in isolated embedded PostgreSQL;
  // only Auth/HTTP transport and starting receipt are synthetic fixtures.
  const db = new PGlite(),
    sql = pgliteSql(db),
    member = "10000000-0000-4000-8000-000000000001";
  // The standard test adapter accepts a callback only. Preserve the production
  // member-view isolation option rather than replacing its SQL projection.
  const begin = sql.begin.bind(sql);
  sql.begin = ((
    option: string | ((tx: Sql) => Promise<unknown>),
    callback?: (tx: Sql) => Promise<unknown>,
  ) => {
    if (typeof option !== "string") return begin(option as never);
    expect(option).toBe("isolation level repeatable read read only");
    return begin(async (tx) => {
      await tx.unsafe(
        "set transaction isolation level repeatable read read only",
      );
      return callback!(tx as unknown as Sql);
    });
  }) as typeof sql.begin;
  const ledger = new CommercialLedger(sql, "acceptance", {
      active: "local",
      values: { local: randomBytes(32) },
    }),
    authorize = async () => {};
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;",
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20261101120754_commercial_google_ledger.sql",
        "utf8",
      ),
    );
    const approvals = {
      owner: "isolated-fixture",
      legal: "isolated-fixture",
      googlePlay: "isolated-fixture",
      privacy: "isolated-fixture",
      retention: "isolated-fixture",
      refundRecovery: "isolated-fixture",
      playerRights: "isolated-fixture",
      supplyReconciliation: "isolated-fixture",
      validUntil: "2099-01-01T00:00:00Z",
      withdrawals: false,
      prizes: false,
      paidEntry: false,
      nba: false,
    };
    await sql`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,policy_version=${commercialPolicyVersion},approvals=${sql.json(approvals)}`;
    await sql`update commercial_billing.products set approved=true`;
    for (let i = 0; i < 12; i++) {
      const player = randomUUID();
      for (const rarity of ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"])
        await sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values(${player},'afl',${rarity},${rarityRule(rarity).lifetimeCap!},true,'isolated-fixture',${sql.json({ name: `Synthetic AFL ${i}`, synthetic: true, team: "Fixture", position: "MID", season: "ISOLATED ACCEPTANCE", verifiedJerseyNumber: null, colour: "#16345A", status: "active" })})`;
    }
    const token = "isolated-browser-purchase",
      product = commercialProducts[0];
    await ledger.accept(
      {
        key: createHash("sha256")
          .update("docked.fantasy\0" + token)
          .digest("hex"),
        account: "a".repeat(64),
        environment: "acceptance",
        product,
        state: "PURCHASED",
        paid: true,
        consumed: false,
        orderId: "GPA.0000-0000-0000",
        grossCents: product.audCents,
        taxCents: null,
        refundedCents: 0,
        providerAt: new Date().toISOString(),
      },
      member,
      token,
      authorize,
    );
    const view = new CommercialMemberView(ledger, member, authorize),
      requests: string[] = [],
      pack = commercialPack("afl", "STANDARD", 9);
    let failNextView = false;
    const script = await bundleCommunityFixture(
      "tests/fixtures/commercial-purchase-recovery.tsx",
    );
    const css = (
      await Promise.all(
        [
          "globals",
          "fantasy",
          "pack-shop",
          "pack-opening",
          "pack-cinematic",
          "pack-cinema-v2",
          "test-wallet",
        ].map((name) => readFile(`src/app/${name}.css`, "utf8")),
      )
    ).join("\n");
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/store/google/commercial") {
        if (route.request().method() === "GET") {
          if (failNextView) {
            failNextView = false;
            return route.fulfill({
              status: 503,
              json: { error: "Injected post-commit history outage" },
            });
          }
          return route.fulfill({ json: await view.packs() });
        }
        const body = route.request().postDataJSON();
        expect(body.expectedMember).toBe(member);
        if (url.searchParams.get("action") === "pack") {
          requests.push(body.request);
          const committed = await ledger.buyPack(
            member,
            body.request,
            body,
            authorize,
          );
          if (requests.length === 1) failNextView = true;
          return route.fulfill({ json: committed });
        }
        if (url.searchParams.get("action") === "open") {
          const r = await ledger.openPack(member, body.id, authorize);
          return route.fulfill({
            json: {
              id: r.pack,
              name: r.product.name,
              opened_at: r.openedAt,
              cards: r.cards.map((c) =>
                commercialCard(c as Parameters<typeof commercialCard>[0]),
              ),
            },
          });
        }
        return route.fulfill({ status: 403, json: { error: "Isolated test" } });
      }
      if (url.pathname === "/api/sports-beta")
        return route.fulfill({ json: { allowed: ["afl", "nrl"] } });
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
      if (/^\/(brand|images|fonts)\//.test(url.pathname)) {
        try {
          return route.fulfill({
            body: await readFile("public" + url.pathname),
            contentType: url.pathname.endsWith(".svg")
              ? "image/svg+xml"
              : url.pathname.endsWith(".woff2")
                ? "font/woff2"
                : "image/webp",
          });
        } catch {
          return route.fulfill({ status: 404 });
        }
      }
      return route.fulfill({
        contentType: "text/html",
        body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="fantasy-mode"><main id="fixture-root"></main><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`,
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      "https://fixture.invalid/fantasy/cards?packs=buy&sport=afl",
    );
    await page
      .getByRole("button", { name: "Buy Standard 9 Pack", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Purchase", exact: true })
      .click();
    await expect(
      page
        .getByText(
          "Purchase confirmed. Your pack is saved, but pack history could not load. Check the saved purchase to retrieve it; do not purchase again.",
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Confirm purchase", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Retrieve purchased pack",
        exact: true,
      }),
    ).toBeVisible();
    expect((await ledger.wallet(member)).balance).toBe(
      product.credits - pack.priceCredits,
    );
    expect(
      (await sql`select count(*)::int n from commercial_billing.cards`)[0].n,
    ).toBe(9);
    const key = `docked:commercial:pending:${member}`;
    const stored = JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), key))!,
    );
    expect(stored.request).toBe(requests[0]);
    expect(stored.confirmed).toBe(true);
    await page.reload();
    await page
      .getByRole("button", { name: "Retrieve purchased pack", exact: true })
      .click();
    await page.getByRole("button", { name: "Open pack", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe(requests[1]);
    expect((await ledger.wallet(member)).balance).toBe(
      product.credits - pack.priceCredits,
    );
    expect(
      (await sql`select count(*)::int n from commercial_billing.cards`)[0].n,
    ).toBe(9);
    expect(
      (await sql`select count(*)::int n from commercial_billing.packs`)[0].n,
    ).toBe(1);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      null,
    );
  } finally {
    await db.close();
  }
});
