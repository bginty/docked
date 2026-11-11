/** Isolated real PostgreSQL only; provider fixtures, never Google/live accounts. */
import assert from "node:assert/strict";
import crypto, { createHash, randomBytes, randomUUID } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { CommercialMemberView } from "../src/server/commercial-member-view";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
  commercialSports,
  type CommercialReceipt,
  type CommercialSport,
} from "../src/core/commercial-billing";
import { rarityRule, limitedRarities } from "../src/core/card-rarity";
import { drawPackRarity } from "../src/core/card-economy";
import {
  paidPackOffers,
  paidPackWeights,
} from "../src/core/paid-pack-catalogue";

const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.href, { max: 24, onnotice: () => {} });
const keys = { active: "isolated", values: { isolated: randomBytes(32) } };
const ledger = new CommercialLedger(sql, "acceptance", keys);
const authorize = async () => {};
const checks: string[] = [];
const evidenceDir =
  process.env.DOCKED_DB_TEST_REPORT_DIR ??
  "docs/ops-paid-readiness-20261106/pack-supply";
let sequence = 0;
function funding() {
  const token = `isolated-pack-supply-${++sequence}`;
  const product = commercialProducts.find((p) => p.credits === 9900)!;
  const receipt: CommercialReceipt = {
    key: createHash("sha256")
      .update("docked.fantasy\0" + token)
      .digest("hex"),
    account: "e".repeat(64),
    environment: "acceptance",
    product,
    state: "PURCHASED",
    paid: true,
    consumed: false,
    orderId: `GPA.ISOLATED-SUPPLY-${sequence}`,
    grossCents: product.audCents,
    taxCents: null,
    refundedCents: 0,
    providerAt: new Date().toISOString(),
  };
  return { token, receipt };
}
async function funded() {
  const member = randomUUID(),
    purchase = funding();
  await ledger.accept(purchase.receipt, member, purchase.token, authorize);
  return { member, purchase };
}
function input(
  sport: CommercialSport,
  family: "STANDARD" | "PREMIUM",
  size: 1 | 3 | 9,
) {
  return {
    sport,
    family,
    size,
    configurationHash: commercialPack(sport, family, size).configurationHash,
    confirmed: true as const,
  };
}
async function definitions(sport: CommercialSport, terminal = false) {
  const rows: { id: string; player: string; rarity: string }[] = [];
  for (let n = 0; n < 12; n++) {
    const player = randomUUID();
    for (const rarity of limitedRarities) {
      const cap = rarityRule(rarity).lifetimeCap!;
      const prior =
        terminal && rarity === "ULTRA_RARE" ? cap - (n === 0 ? 1 : 0) : 0;
      const [row] =
        await sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot) values(${player},${sport},${rarity},${cap},${prior},${prior},true,'ISOLATED FIXTURE; NOT RIGHTS EVIDENCE',${sql.json({ name: `Synthetic ${sport} ${n}`, team: "Fixture", position: sport === "nfl" ? "QB" : sport === "afl" ? "MID" : "WFB", season: "ISOLATED", status: "active", synthetic: true, colour: "#16345A", verifiedJerseyNumber: null })}) returning id`;
      rows.push({ id: row.id, player, rarity });
    }
  }
  return rows;
}
async function fingerprint() {
  const tables = [
    "accounts",
    "receipts",
    "receipt_events",
    "lots",
    "journals",
    "lines",
    "recovery_cases",
    "definitions",
    "packs",
    "cards",
    "ownership_events",
    "audit",
  ];
  const result: Record<string, string> = {};
  for (const table of tables) {
    const [r] = await sql.unsafe(
      `select md5(coalesce(string_agg(t::text,',' order by t::text),'')) h from (select to_jsonb(x) t from commercial_billing.${table} x) s`,
    );
    result[table] = r.h;
  }
  return result;
}
async function zeroDraw<T>(run: () => Promise<T>) {
  // Only this loopback fixture process patches the built-in. Production retains
  // crypto.randomInt; no random-source input is added to a public/server API.
  const patched = mock.method(crypto, "randomInt", () => 0);
  syncBuiltinESMExports();
  try {
    return await run();
  } finally {
    patched.mock.restore();
    syncBuiltinESMExports();
  }
}
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function main() {
  try {
    await sql.unsafe(
      "create role anon; create role authenticated; create role service_role;",
    );
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261101120754_commercial_google_ledger.sql",
        "utf8",
      ),
    );
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261109231834_commercial_lifetime_supply_guards.sql",
        "utf8",
      ),
    );
    const approvals = Object.fromEntries(
      [
        "owner",
        "legal",
        "googlePlay",
        "privacy",
        "retention",
        "refundRecovery",
        "playerRights",
        "supplyReconciliation",
      ].map((key) => [key, "ISOLATED FIXTURE ONLY"]),
    );
    Object.assign(approvals, {
      validUntil: "2099-01-01T00:00:00Z",
      withdrawals: false,
      prizes: false,
      paidEntry: false,
      nba: false,
    });
    await sql`update commercial_billing.control set policy_version=${commercialPolicyVersion},issuance_enabled=true,approvals=${sql.json(approvals)}`;
    for (const sport of commercialSports) await definitions(sport);
    await check(
      "real commercial mode rejects synthetic supply before creating accounts or cards",
      async () => {
        const commercial = new CommercialLedger(sql, "commercial", keys);
        await assert.rejects(
          commercial.buyPack(
            randomUUID(),
            randomUUID(),
            input("afl", "PREMIUM", 1),
            authorize,
          ),
          /Synthetic/,
        );
        assert.equal(
          (
            await sql`select count(*)::int n from commercial_billing.accounts`
          )[0].n,
          0,
        );
        assert.equal(
          (await sql`select count(*)::int n from commercial_billing.cards`)[0]
            .n,
          0,
        );
      },
    );
    await sql`update commercial_billing.control set environment='acceptance',sales_enabled=true`;
    await sql`update commercial_billing.products set approved=true`;
    const gap = await funded();
    await sql`update commercial_billing.definitions set approved=false where id in (select id from commercial_billing.definitions where sport='nrl' and rarity='ICON' order by id offset 8)`;
    const visible = (
      await new CommercialMemberView(ledger, gap.member, authorize).packs()
    ).products.find((p) => p.id === commercialPack("nrl", "PREMIUM", 9).id)!;
    assert.equal(visible.available, false);
    if (process.argv.includes("--reproduce-old")) {
      const before = await ledger.wallet(gap.member);
      const bought = await zeroDraw(() =>
        ledger.buyPack(
          gap.member,
          randomUUID(),
          input("nrl", "PREMIUM", 9),
          authorize,
        ),
      );
      const [counts] =
        await sql`select count(*)::int cards from commercial_billing.cards where pack=${bought.id}`;
      mkdirSync(evidenceDir, { recursive: true });
      const result = {
        at: new Date().toISOString(),
        reproduced: true,
        visibleAvailable: visible.available,
        issuedCards: counts.cards,
        creditsBefore: before.balance,
        creditsAfter: (await ledger.wallet(gap.member)).balance,
        productionWrites: 0,
        realPayments: 0,
        fixtureOnly: true,
      };
      assert.equal(counts.cards, 9);
      writeFileSync(
        `${evidenceDir}/before-fix.json`,
        JSON.stringify(result, null, 2) + "\n",
      );
      console.log(JSON.stringify(result));
      return;
    }
    await check(
      "direct requests cannot bypass the visible all-rarity supply gate",
      async () => {
        const before = await fingerprint();
        await zeroDraw(() =>
          assert.rejects(
            ledger.buyPack(
              gap.member,
              randomUUID(),
              input("nrl", "PREMIUM", 9),
              authorize,
            ),
            /supply unavailable/,
          ),
        );
        assert.deepEqual(await fingerprint(), before);
      },
    );
    await sql`update commercial_billing.definitions set approved=true where sport='nrl'`;
    await check(
      "all18 products retain exact per-slot odds over every10000 ticket outcomes",
      async () => {
        const ids = new Set<string>();
        for (const sport of commercialSports)
          for (const offer of paidPackOffers) {
            const p = commercialPack(sport, offer.type, offer.cards);
            ids.add(p.id);
            assert.equal(p.priceCredits, offer.priceCredits);
            assert.deepEqual(p.weights, paidPackWeights[offer.type]);
            assert.deepEqual(p.guaranteedSlots, {});
            for (let slot = 0; slot < p.cards; slot++) {
              const counts = Object.fromEntries(
                limitedRarities.map((r) => [r, 0]),
              );
              for (let ticket = 0; ticket < 10000; ticket++)
                counts[drawPackRarity(p, slot, () => ticket)]++;
              assert.deepEqual(counts, p.weights);
            }
          }
        assert.equal(ids.size, 18);
      },
    );
    await check(
      "all18 real SQL purchases have exact quantity, price, sport, unique players and idempotent openings",
      async () => {
        for (const sport of commercialSports)
          for (const offer of paidPackOffers) {
            const { member } = await funded(),
              request = randomUUID();
            const p = input(sport, offer.type, offer.cards);
            const bought = await ledger.buyPack(member, request, p, authorize);
            assert.equal(
              (await ledger.wallet(member)).balance,
              9900 - offer.priceCredits,
            );
            assert.deepEqual(
              await ledger.buyPack(member, request, p, authorize),
              bought,
            );
            const opened = await ledger.openPack(member, bought.id, authorize);
            assert.equal(opened.cards.length, offer.cards);
            assert.equal(
              new Set(opened.cards.map((c) => c.player_id)).size,
              offer.cards,
            );
            assert(
              opened.cards.every(
                (c) => c.sport === sport && c.rarity !== "CORE",
              ),
            );
            assert.deepEqual(
              await ledger.openPack(member, bought.id, authorize),
              opened,
            );
            await assert.rejects(
              ledger.openPack(randomUUID(), bought.id, authorize),
              /not found/,
            );
          }
      },
    );
    await check(
      "a fault after seven serial allocations rolls back funding, inventory and audit, then retry issues once",
      async () => {
        const { member, purchase } = await funded(),
          request = randomUUID();
        await sql.unsafe(
          "create function public.isolated_pack_fault() returns trigger language plpgsql as $$begin if new.slot=6 then raise exception 'ISOLATED_CARD_FAULT'; end if; return new; end$$; create trigger isolated_pack_fault after insert on commercial_billing.cards for each row execute function public.isolated_pack_fault();",
        );
        const before = await fingerprint();
        await assert.rejects(
          ledger.buyPack(
            member,
            request,
            input("afl", "PREMIUM", 9),
            authorize,
          ),
          /ISOLATED_CARD_FAULT/,
        );
        assert.deepEqual(await fingerprint(), before);
        await sql.unsafe(
          "drop trigger isolated_pack_fault on commercial_billing.cards; drop function public.isolated_pack_fault();",
        );
        const bought = await ledger.buyPack(
          member,
          request,
          input("afl", "PREMIUM", 9),
          authorize,
        );
        const opened = await ledger.openPack(member, bought.id, authorize);
        const [inventory] =
          await sql`select md5(string_agg(c::text,',' order by c.id)) h from commercial_billing.cards c where pack=${bought.id}`;
        await ledger.accept(
          {
            ...purchase.receipt,
            state: "REVOKED",
            refundedCents: purchase.receipt.grossCents!,
            providerAt: new Date(Date.now() + 1000).toISOString(),
          },
          member,
          purchase.token,
          authorize,
        );
        const wallet = await ledger.wallet(member);
        assert.equal(wallet.balance, 0);
        assert.equal(wallet.spendable, 0);
        assert.equal(wallet.reviewRequired, true);
        assert.equal(
          (
            await sql`select md5(string_agg(c::text,',' order by c.id)) h from commercial_billing.cards c where pack=${bought.id}`
          )[0].h,
          inventory.h,
        );
        assert.deepEqual(
          await ledger.openPack(member, bought.id, authorize),
          opened,
        );
        assert.equal(
          (
            await sql`select exposure_credits::int n from commercial_billing.recovery_cases where member_id=${member}`
          )[0].n,
          5000,
        );
      },
    );
    await check(
      "twenty buyers competing for the last allowed serial issue once without oversell or duplicate debit",
      async () => {
        await sql`update commercial_billing.definitions set approved=false where sport='nfl'`;
        const terminal = await definitions("nfl", true);
        const buyers = await Promise.all(
          Array.from({ length: 20 }, () => funded()),
        );
        const requests = buyers.map(() => randomUUID());
        const outcomes = await zeroDraw(() =>
          Promise.allSettled(
            buyers.map((b, i) =>
              ledger.buyPack(
                b.member,
                requests[i],
                input("nfl", "PREMIUM", 1),
                authorize,
              ),
            ),
          ),
        );
        const winners = outcomes.flatMap((r, i) =>
          r.status === "fulfilled" ? [i] : [],
        );
        assert.equal(winners.length, 1);
        const winner = winners[0],
          outcome = outcomes[winner];
        assert.equal(outcome.status, "fulfilled");
        if (outcome.status !== "fulfilled")
          throw Error("Fixture winner absent");
        const opened = await ledger.openPack(
          buyers[winner].member,
          outcome.value.id,
          authorize,
        );
        assert.equal(
          opened.cards[0].serial,
          rarityRule("ULTRA_RARE").lifetimeCap,
        );
        assert.deepEqual(
          await ledger.buyPack(
            buyers[winner].member,
            requests[winner],
            input("nfl", "PREMIUM", 1),
            authorize,
          ),
          outcome.value,
        );
        for (const [i, b] of buyers.entries())
          assert.equal(
            (await ledger.wallet(b.member)).balance,
            9900 - (i === winner ? 700 : 0),
          );
        await assert.rejects(
          sql`insert into commercial_billing.cards(definition,serial,owner_id,pack,slot) values(${opened.cards[0].definition},${Number(opened.cards[0].serial) + 1},${buyers[winner].member},${outcome.value.id},1)`,
          /Supply exhausted|current purchased pack/,
        );
        assert.equal(
          (
            await sql`select count(*)::int n from commercial_billing.cards where definition=any(${sql.array(terminal.filter((r) => r.rarity === "ULTRA_RARE").map((r) => r.id))}::uuid[])`
          )[0].n,
          1,
        );
      },
    );
    await check(
      "all journals balance; issued-minus-legacy equals preserved instances; no negative spendable credit",
      async () => {
        assert.equal(
          (
            await sql`select journal from commercial_billing.lines group by journal having sum(amount)<>0`
          ).length,
          0,
        );
        assert.equal(
          (
            await sql`select id from commercial_billing.definitions d where d.issued-d.legacy_issued<>(select count(*) from commercial_billing.cards c where c.definition=d.id) or d.issued>d.lifetime_cap`
          ).length,
          0,
        );
        assert.equal(
          (
            await sql`select definition,serial from commercial_billing.cards group by definition,serial having count(*)>1`
          ).length,
          0,
        );
        assert.equal(
          (await sql`select id from commercial_billing.lots where remaining<0`)
            .length,
          0,
        );
        assert.equal(
          (
            await sql`select a.member_id from commercial_billing.accounts a where coalesce((select sum(remaining) from commercial_billing.lots where member_id=a.member_id),0)<>coalesce((select sum(l.amount) from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.unit='CREDITS' and l.account='member:'||a.member_id),0)`
          ).length,
          0,
        );
      },
    );
    mkdirSync(evidenceDir, { recursive: true });
    const result = {
      at: new Date().toISOString(),
      engine: (await sql`select version()`)[0].version,
      checks,
      passed: true,
      productionWrites: 0,
      realPayments: 0,
      providerCalls: 0,
      permanentCardsIssued: 0,
      fixtureOnly: true,
    };
    writeFileSync(
      `${evidenceDir}/postgres.json`,
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result));
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Isolated supply check failed",
  );
  process.exitCode = 1;
});
