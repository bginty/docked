import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { CommercialReconciliation } from "../src/server/commercial-reconciliation";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { CommercialMemberView } from "../src/server/commercial-member-view";
import { commercialBrowser } from "./commercial-browser";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
  type CommercialReceipt,
} from "../src/core/commercial-billing";
import { rarityRule } from "../src/core/card-rarity";
const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
if (url.hostname !== "127.0.0.1" || url.pathname !== "/commercial_acceptance")
  throw Error("Disposable loopback database required");
const sql = postgres(url.toString(), { max: 20, onnotice: () => {} }),
  checks: string[] = [];
const keys = { active: "local", values: { local: randomBytes(32) } };
const ledger = new CommercialLedger(sql, "acceptance", keys);
const authorize = async () => {};
const member = randomUUID(),
  other = randomUUID();
let seq = 0;
function receipt(credits = 4900) {
  const token = `isolated-commercial-fixture-${++seq}`,
    product = commercialProducts.find((p) => p.credits === credits)!;
  const r: CommercialReceipt = {
    key: createHash("sha256")
      .update("docked.fantasy\0" + token)
      .digest("hex"),
    account: "a".repeat(64),
    environment: "acceptance",
    product,
    state: "PURCHASED",
    paid: true,
    consumed: false,
    orderId: `GPA.0000-0000-${seq}`,
    grossCents: product.audCents,
    taxCents: null,
    refundedCents: 0,
    providerAt: new Date().toISOString(),
  };
  return { r, token };
}
const accept = (x: ReturnType<typeof receipt>, who = member) =>
  ledger.accept(x.r, who, x.token, authorize);
const refund = async (x: ReturnType<typeof receipt>, who = member) => {
  x.r = {
    ...x.r,
    state: "REVOKED",
    refundedCents: x.r.grossCents!,
    providerAt: new Date().toISOString(),
  };
  return accept(x, who);
};
const check = async (name: string, f: () => Promise<void>) => {
  await f();
  checks.push(name);
  console.log(`PASS ${name}`);
};
async function main() {
  await sql.unsafe(
    "create role anon;create role authenticated;create role service_role;",
  );
  const migration = readFileSync(
    "supabase/migrations/20261101120754_commercial_google_ledger.sql",
    "utf8",
  );
  await sql.unsafe(migration);
  await sql.unsafe(migration);
  await sql.unsafe(
    readFileSync(
      "supabase/migrations/20261109231834_commercial_lifetime_supply_guards.sql",
      "utf8",
    ),
  );
  await check(
    "migration reapplication leaves gates closed and creates no accounts",
    async () => {
      assert.equal(
        (await sql`select sales_enabled from commercial_billing.control`)[0]
          .sales_enabled,
        false,
      );
      assert.equal(
        (await sql`select count(*)::int n from commercial_billing.accounts`)[0]
          .n,
        0,
      );
      await assert.rejects(accept(receipt()), /environment mismatch/);
    },
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
  await sql`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,transfers_enabled=true,policy_version=${commercialPolicyVersion},approvals=${sql.json(approvals)}`;
  await sql`update commercial_billing.products set approved=true`;
  // All 3 pools are synthetic fixtures, never real players or permanent inventory.
  for (const sport of ["nfl", "afl", "nrl"])
    for (let i = 0; i < 12; i++) {
      const player = randomUUID();
      for (const rarity of ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"])
        await sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values(${player},${sport},${rarity},${rarityRule(rarity).lifetimeCap!},true,'isolated-fixture',${sql.json({ name: `Synthetic ${sport} ${i}`, synthetic: true, team: "Fixture", position: sport === "nfl" ? "QB" : sport === "afl" ? "MID" : "HLF", season: "ISOLATED ACCEPTANCE", verifiedJerseyNumber: null, colour: "#16345A", status: "active" })})`;
    }
  await check("pending and cancelled purchases never credit", async () => {
    const x = receipt();
    x.r.state = "PENDING";
    x.r.paid = false;
    await accept(x);
    x.r.state = "CANCELLED";
    await accept(x);
    assert.equal((await ledger.wallet(member)).balance, 0);
  });
  await check(
    "delayed approval and 20 concurrent retries fulfil exactly once",
    async () => {
      const x = receipt();
      x.r.state = "PENDING";
      x.r.paid = false;
      await accept(x);
      x.r.state = "PURCHASED";
      x.r.paid = true;
      await Promise.all(Array.from({ length: 20 }, () => accept(x)));
      assert.equal((await ledger.wallet(member)).balance, 4900);
      await assert.rejects(accept(x, other), /another account/);
      await refund(x);
      await refund(x);
      assert.equal((await ledger.wallet(member)).balance, 0);
      assert.equal(
        (
          await sql`select count(*)::int n from commercial_billing.recovery_cases`
        )[0].n,
        0,
      );
    },
  );
  await check(
    "refund after partial spending, opened pack, and replay preserves cards with a recovery hold",
    async () => {
      const x = receipt();
      await accept(x);
      const p = commercialPack("afl", "STANDARD", 9),
        request = randomUUID();
      const buys = await Promise.all(
        Array.from({ length: 12 }, () =>
          ledger.buyPack(
            member,
            request,
            {
              sport: "afl",
              family: "STANDARD",
              size: 9,
              configurationHash: p.configurationHash,
              confirmed: true,
            },
            authorize,
          ),
        ),
      );
      assert.equal(new Set(buys.map((b) => b.id)).size, 1);
      assert.equal((await ledger.wallet(member)).balance, 4200);
      const opened = await ledger.openPack(member, buys[0].id, authorize);
      assert.equal(opened.cards.length, 9);
      assert.equal(new Set(opened.cards.map((c) => c.player_id)).size, 9);
      await ledger.openPack(member, buys[0].id, authorize);
      await refund(x);
      await refund(x);
      assert.equal((await ledger.wallet(member)).balance, 0);
      const [c] =
        await sql`select * from commercial_billing.recovery_cases where receipt=${x.r.key}`;
      assert.equal(Number(c.exposure_credits), 700);
      await assert.rejects(accept(receipt()), /Account review/);
      await assert.rejects(
        ledger.resolveRecovery(
          c.id,
          1,
          "Reviewed isolated customer remedy",
          member,
          authorize,
        ),
        /Independent/,
      );
      await ledger.resolveRecovery(
        c.id,
        1,
        "Reviewed isolated customer remedy",
        randomUUID(),
        authorize,
      );
      await refund(x);
      assert.equal(
        (
          await sql`select state from commercial_billing.recovery_cases where id=${c.id}`
        )[0].state,
        "WAIVED",
      );
      assert.equal(
        (await ledger.openPack(member, buys[0].id, authorize)).cards.length,
        9,
      );
    },
  );
  await check(
    "concurrent 9900 purchases and atomic failure preserve balances",
    async () => {
      await Promise.all([accept(receipt(9900)), accept(receipt(9900))]);
      assert.equal((await ledger.wallet(member)).balance, 19800);
      await assert.rejects(
        ledger.buyPack(
          member,
          randomUUID(),
          {
            sport: "nrl",
            family: "PREMIUM",
            size: 9,
            configurationHash: "stale",
            confirmed: true,
          },
          authorize,
        ),
        /quote changed/,
      );
      assert.equal((await ledger.wallet(member)).balance, 19800);
      await assert.rejects(
        ledger.buyPack(
          member,
          randomUUID(),
          {
            sport: "basketball" as never,
            family: "STANDARD",
            size: 9,
            configurationHash: "x",
            confirmed: true,
          },
          authorize,
        ),
        /Sport unavailable/,
      );
    },
  );
  await check(
    "card sale, fee, refund after transfer never debit unrelated member",
    async () => {
      const x = receipt(9900);
      await accept(x, other);
      const p = commercialPack("nrl", "STANDARD", 1);
      const pack = await ledger.buyPack(
        member,
        randomUUID(),
        {
          sport: "nrl",
          family: "STANDARD",
          size: 1,
          configurationHash: p.configurationHash,
          confirmed: true,
        },
        authorize,
      );
      const opened = await ledger.openPack(member, pack.id, authorize);
      const listing = await ledger.list(
        member,
        opened.cards[0].id,
        1000,
        authorize,
      );
      const purchases = await Promise.all(
        Array.from({ length: 10 }, () =>
          ledger.buyListing(other, listing.id, 1000, 1, authorize),
        ),
      );
      assert.equal(purchases[0].fee, 50);
      const before = await ledger.wallet(member);
      await refund(x, other);
      await refund(x, other);
      assert.deepEqual(await ledger.wallet(member), before);
      const [card] =
        await sql`select owner_id from commercial_billing.cards where id=${opened.cards[0].id}`;
      assert.equal(card.owner_id, other);
      assert.equal(
        Number(
          (
            await sql`select exposure_credits from commercial_billing.recovery_cases where receipt=${x.r.key}`
          )[0].exposure_credits,
        ),
        1000,
      );
    },
  );
  await check(
    "partial refunds held, full refund replacement is not cumulative",
    async () => {
      const who = randomUUID(),
        x = receipt();
      await accept(x, who);
      x.r.state = "REVIEW";
      x.r.refundedCents = 100;
      await accept(x, who);
      assert.equal((await ledger.wallet(who)).spendable, 0);
      await refund(x, who);
      await refund(x, who);
      assert.equal((await ledger.wallet(who)).balance, 0);
      const [r] =
        await sql`select refunded_cents from commercial_billing.receipts where key=${x.r.key}`;
      assert.equal(Number(r.refunded_cents), 4900);
      const [updated] =
        await sql`select exposure_credits,revision from commercial_billing.recovery_cases where receipt=${x.r.key}`;
      assert.equal(Number(updated.exposure_credits), 0);
      assert.equal(updated.revision, 2);
      await assert.rejects(
        ledger.resolveRecovery(
          x.r.key,
          1,
          "Stale review must not change newer provider state",
          randomUUID(),
          authorize,
        ),
        /Review changed/,
      );
      x.r = {
        ...x.r,
        state: "PURCHASED",
        refundedCents: 0,
        providerAt: "2020-01-01T00:00:00Z",
      };
      await accept(x, who);
      assert.equal((await ledger.wallet(who)).balance, 0);
    },
  );
  await check(
    "charged price mismatch records money, grants no credits",
    async () => {
      const who = randomUUID(),
        x = receipt();
      x.r.state = "REVIEW";
      x.r.grossCents = 4800;
      await accept(x, who);
      assert.equal((await ledger.wallet(who)).balance, 0);
      assert.equal(
        (
          await sql`select money_recorded from commercial_billing.receipts where key=${x.r.key}`
        )[0].money_recorded,
        true,
      );
    },
  );
  await check(
    "durable notifications, outages, leases and reconciliation after restart",
    async () => {
      const who = randomUUID(),
        x = receipt();
      await accept(x, who);
      await sql`update commercial_billing.jobs set state='done'`;
      let outage = true,
        consumes = 0;
      const verifier = {
        verify: async () => {
          if (outage) throw Error("offline");
          return x.r;
        },
        consume: async () => {
          consumes++;
        },
      };
      const worker = new CommercialReconciliation(
        ledger,
        verifier,
        async () => true,
      );
      const notice = {
        id: "d".repeat(64),
        receiptKey: x.r.key,
        kind: "voided" as const,
        occurredAt: Date.now(),
      };
      assert.equal(await worker.enqueue(notice), true);
      assert.equal(await worker.enqueue(notice), false);
      await worker.runOne();
      assert.equal((await ledger.wallet(who)).balance, 4900);
      assert.equal(
        (
          await sql`select state from commercial_billing.jobs where id=${"push:" + notice.id}`
        )[0].state,
        "pending",
      );
      x.r = { ...x.r, state: "REVOKED", refundedCents: 4900 };
      outage = false;
      await sql`update commercial_billing.jobs set next_attempt_at=clock_timestamp() where id=${"push:" + notice.id}`;
      const restarted = new CommercialReconciliation(
        new CommercialLedger(sql, "acceptance", keys),
        verifier,
        async () => true,
      );
      await Promise.all([restarted.runOne(), restarted.runOne()]);
      assert.equal((await ledger.wallet(who)).balance, 0);
      assert.equal(consumes, 0);
      assert.equal(
        (
          await sql`select state from commercial_billing.jobs where id=${"push:" + notice.id}`
        )[0].state,
        "done",
      );
      await sql`insert into commercial_billing.jobs(id,kind,state,attempts,lease_until) values('expired','test','working',12,clock_timestamp()-interval '1 hour')`;
      await restarted.runOne();
      assert.equal((await restarted.health()).attention, 1);
      await sql`update commercial_billing.control set sales_enabled=false`;
      const y = receipt();
      await assert.rejects(accept(y), /disabled/);
      await sql`update commercial_billing.control set sales_enabled=true`;
    },
  );
  await check(
    "delayed approval after account closure requires remedy review, never new fulfilment",
    async () => {
      await sql`update commercial_billing.jobs set state='done'`;
      const who = randomUUID(),
        x = receipt();
      x.r = { ...x.r, state: "PENDING", paid: false, grossCents: null };
      await accept(x, who);
      x.r = { ...x.r, state: "PURCHASED", paid: true, grossCents: 4900 };
      let consumed = 0;
      const worker = new CommercialReconciliation(
        ledger,
        {
          verify: async () => x.r,
          consume: async () => {
            consumed++;
          },
        },
        async () => false,
      );
      await worker.enqueue({
        id: "e".repeat(64),
        receiptKey: x.r.key,
        kind: "purchase",
        occurredAt: Date.now(),
      });
      await worker.runOne();
      const [r] =
        await sql`select state,credited,money_recorded from commercial_billing.receipts where key=${x.r.key}`;
      assert.deepEqual(
        { state: r.state, credited: r.credited, money: r.money_recorded },
        { state: "REVIEW", credited: false, money: true },
      );
      assert.equal((await ledger.wallet(who)).balance, 0);
      assert.equal(consumed, 0);
      x.r = { ...x.r, state: "REVOKED", refundedCents: 4900 };
      await worker.enqueue({
        id: "f".repeat(64),
        receiptKey: x.r.key,
        kind: "voided",
        occurredAt: Date.now(),
      });
      await worker.runOne();
      assert.equal(
        (
          await sql`select refunded_cents from commercial_billing.receipts where key=${x.r.key}`
        )[0].refunded_cents,
        "4900",
      );
    },
  );
  await check(
    "runtime least-privilege role can read and accept but cannot activate",
    async () => {
      const password = randomBytes(24).toString("hex");
      await sql.unsafe(
        `create role billing_acceptance_login login password '${password}';grant docked_commercial_app to billing_acceptance_login`,
      );
      const restrictedUrl = new URL(url);
      restrictedUrl.username = "billing_acceptance_login";
      restrictedUrl.password = password;
      const restricted = postgres(restrictedUrl.toString(), {
        max: 4,
        onnotice: () => {},
      });
      try {
        const service = new CommercialLedger(restricted, "acceptance", keys),
          who = randomUUID(),
          x = receipt();
        await service.accept(x.r, who, x.token, authorize);
        const p = commercialPack("afl", "STANDARD", 9),
          request = randomUUID();
        const results = await Promise.all(
          Array.from({ length: 8 }, () =>
            service.buyPack(
              who,
              request,
              {
                sport: "afl",
                family: "STANDARD",
                size: 9,
                configurationHash: p.configurationHash,
                confirmed: true,
              },
              authorize,
            ),
          ),
        );
        assert.equal(new Set(results.map((r) => r.id)).size, 1);
        await service.openPack(who, results[0].id, authorize);
        assert.equal((await service.wallet(who)).balance, 4200);
        const projection = new CommercialMemberView(service, who, authorize);
        const cards = await projection.collection({ sport: "afl" });
        assert.equal(cards.total, 9);
        assert.equal(cards.cards.length, 9);
        assert.equal(
          Object.values(cards.counts).reduce((a, b) => a + (b ?? 0), 0),
          9,
        );
        assert.equal((await projection.collection({ sport: "nrl" })).total, 0);
        await assert.rejects(
          projection.collection({ sport: "basketball" }),
          /Sport unavailable/,
        );
        const shop = await projection.packs();
        assert.equal(shop.packs.length, 1);
        assert.equal(shop.products.length, 18);
        assert.equal(shop.wallet.spendable, 4200);
        assert.equal(
          (
            await new CommercialMemberView(
              service,
              randomUUID(),
              authorize,
            ).collection({ sport: "afl" })
          ).total,
          0,
        );
      } finally {
        await restricted.end();
      }
      await sql.begin(async (tx) => {
        await tx`set local role docked_commercial_app`;
        assert.ok(
          (await tx`select key from commercial_billing.receipts limit 1`)
            .length,
        );
      });
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`set local role docked_commercial_app`;
          await tx`update commercial_billing.control set sales_enabled=true`;
        }),
        /permission denied/,
      );
    },
  );
  await check(
    "refund after original pack is transferred preserves buyer funds and ownership",
    async () => {
      const seller = randomUUID(),
        buyer = randomUUID(),
        x = receipt(),
        y = receipt();
      await accept(x, seller);
      await accept(y, buyer);
      const p = commercialPack("afl", "STANDARD", 1),
        b = await ledger.buyPack(
          seller,
          randomUUID(),
          {
            sport: "afl",
            family: "STANDARD",
            size: 1,
            configurationHash: p.configurationHash,
            confirmed: true,
          },
          authorize,
        );
      await assert.rejects(
        ledger.openPack(buyer, b.id, authorize),
        /not found/,
      );
      const cards = await ledger.openPack(seller, b.id, authorize),
        listing = await ledger.list(seller, cards.cards[0].id, 10, authorize);
      const sale = await ledger.buyListing(buyer, listing.id, 10, 1, authorize);
      assert.equal(sale.fee, 1);
      const before = await ledger.wallet(buyer);
      await refund(x, seller);
      assert.deepEqual(await ledger.wallet(buyer), before);
      assert.equal(
        (
          await sql`select owner_id from commercial_billing.cards where id=${cards.cards[0].id}`
        )[0].owner_id,
        buyer,
      );
      assert.equal((await ledger.wallet(seller)).spendable, 0);
    },
  );
  await check(
    "unopened refunded pack stays recorded and cannot be opened while held",
    async () => {
      const who = randomUUID(),
        x = receipt();
      await accept(x, who);
      const p = commercialPack("nfl", "STANDARD", 1);
      const b = await ledger.buyPack(
        who,
        randomUUID(),
        {
          sport: "nfl",
          family: "STANDARD",
          size: 1,
          configurationHash: p.configurationHash,
          confirmed: true,
        },
        authorize,
      );
      await refund(x, who);
      await assert.rejects(ledger.openPack(who, b.id, authorize), /review/);
      assert.equal(
        (
          await sql`select opened_at from commercial_billing.packs where id=${b.id}`
        )[0].opened_at,
        null,
      );
    },
  );
  await check(
    "empty supply, insufficient balance and stale account permission roll back atomically",
    async () => {
      const who = randomUUID(),
        x = receipt();
      await accept(x, who);
      const p = commercialPack("nfl", "PREMIUM", 9);
      await assert.rejects(
        ledger.buyPack(
          who,
          randomUUID(),
          {
            sport: "nfl",
            family: "PREMIUM",
            size: 9,
            configurationHash: p.configurationHash,
            confirmed: true,
          },
          authorize,
        ),
        /Insufficient/,
      );
      await sql`update commercial_billing.definitions set approved=false where sport='nrl'`;
      const n = commercialPack("nrl", "STANDARD", 9);
      await assert.rejects(
        ledger.buyPack(
          who,
          randomUUID(),
          {
            sport: "nrl",
            family: "STANDARD",
            size: 9,
            configurationHash: n.configurationHash,
            confirmed: true,
          },
          authorize,
        ),
        /supply unavailable/,
      );
      await sql`update commercial_billing.definitions set approved=true where sport='nrl'`;
      const denied = receipt();
      await assert.rejects(
        ledger.accept(denied.r, who, denied.token, async () => {
          throw Error("Session revoked");
        }),
        /Session revoked/,
      );
      assert.equal((await ledger.wallet(who)).balance, 4900);
      assert.equal(
        (
          await sql`select count(*)::int n from commercial_billing.packs where member_id=${who}`
        )[0].n,
        0,
      );
    },
  );
  await check(
    "RLS, immutability, environment isolation and balanced accounting",
    async () => {
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select * from commercial_billing.receipts`;
        }),
        /permission denied/,
      );
      await assert.rejects(
        sql`update commercial_billing.control set environment='commercial'`,
        /Cannot convert/,
      );
      await assert.rejects(
        sql`update commercial_billing.lines set amount=amount+1`,
        /Immutable/,
      );
      assert.equal(
        (
          await sql`select journal from commercial_billing.lines group by journal having sum(amount)<>0`
        ).length,
        0,
      );
      assert.equal(
        (
          await sql`select member_id from commercial_billing.lots group by member_id having sum(remaining)<0`
        ).length,
        0,
      );
      const [plaintext] =
        await sql`select encrypted_reference from commercial_billing.receipts limit 1`;
      assert.ok(
        !plaintext.encrypted_reference.includes("isolated-commercial-fixture"),
      );
      const all =
        await sql`select a.member_id,coalesce((select sum(remaining) from commercial_billing.lots where member_id=a.member_id),0) lot,coalesce((select sum(l.amount) from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.unit='CREDITS' and l.account='member:'||a.member_id),0) ledger from commercial_billing.accounts a`;
      for (const a of all) assert.equal(a.lot, a.ledger);
    },
  );
  mkdirSync("docs/qa/commercial-billing-20261101", { recursive: true });
  if (process.argv.includes("--browser"))
    await check(
      "rendered shared commercial packs, collection and wallet on mobile and desktop",
      async () => {
        const who = randomUUID();
        await accept(receipt(9900), who);
        await commercialBrowser(ledger, who);
      },
    );
  writeFileSync(
    "docs/qa/commercial-billing-20261101/postgres.json",
    JSON.stringify(
      {
        environment: "disposable-loopback-PostgreSQL",
        synthetic: true,
        realSettlement: false,
        checks,
        report: await ledger.financialReport(),
      },
      null,
      2,
    ) + "\n",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
