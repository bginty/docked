// Actual hosted store/guards, one rollback-only transaction; no human mutations.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { refreshEconomyCatalogue } from "../src/server/economy-catalogue";
import { wallet, financialReport } from "../src/core/credits-sandbox";
import { digest } from "../src/core/scoring-engine";
async function main() {
  const sql = ownerDatabase();
  const checks: string[] = [];
  try {
    const fingerprint = async () =>
      digest(
        (await sql`select document from credits_sandbox.state where id`)[0]
          .document,
      );
    const before = await fingerprint();
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71820342)`;
        const db: any = new Proxy(tx, {
          get(t, k) {
            if (k === "begin") return (f: any) => t.savepoint(f);
            const v = Reflect.get(t, k);
            return typeof v === "function" ? v.bind(t) : v;
          },
        });
        const store = new CreditsSandboxStore(db, refreshEconomyCatalogue);
        const admin = {
          id: "rollback-credit-only",
          role: "reviewer",
          aal: "aal2",
        } as const;
        const a = { id: randomUUID(), role: "member" } as const,
          b = { id: randomUUID(), role: "member" } as const;
        await store.execute(admin, randomUUID(), {
          kind: "credit-only-policy",
          reason: "Rollback-only hosted policy verification",
        });
        for (const member of [a, b]) {
          await store.execute(admin, randomUUID(), {
            kind: "promotion",
            member: member.id,
            amount: 900,
            campaign: "credit-only-rollback",
            reason: "Rollback-only dedicated nonwithdrawable QA credits",
            confirmed: true,
            redeemable: false,
          });
          const state = await store.read(),
            id = randomUUID();
          const p = state.economy!.products["standard-nine-test-v1"];
          const cmd = {
            kind: "buy-pack",
            product: p.id,
            configuration: p.version,
            confirmed: true,
            policy: state.policy.version,
          };
          const first = await store.execute(member, id, cmd);
          assert.deepEqual(await store.execute(member, id, cmd), first);
          await store.execute(member, randomUUID(), {
            kind: "open-pack",
            entitlement: id,
          });
          assert.equal(wallet(await store.read(), member.id).spendable, 0);
        }
        const s = await store.read(),
          cards = [a, b].map((m) =>
            Object.keys(s.commerce.cards).find(
              (id) => s.commerce.cards[id].owner === m.id,
            )!,
          );
        assert.ok(cards.every(Boolean));
        const now = Number(
          (
            await tx`select (extract(epoch from clock_timestamp())*1000)::bigint now`
          )[0].now,
        );
        await store.execute(admin, randomUUID(), {
          kind: "swap-window",
          start: now + 1000,
          end: now + 60000,
          reason: "Rollback-only zero-balance free-window acceptance",
        });
        await new Promise((r) => setTimeout(r, 1200));
        const offer = randomUUID();
        await store.execute(a, offer, {
          kind: "offer",
          other: b.id,
          give: [cards[0]],
          take: [cards[1]],
          feeEach: 0,
        });
        await store.execute(b, randomUUID(), {
          kind: "accept",
          swap: offer,
          feeEach: 0,
        });
        const after = await store.read();
        assert.equal(after.commerce.cards[cards[0]].owner, b.id);
        assert.equal(after.commerce.cards[cards[1]].owner, a.id);
        assert.equal(after.swaps[offer].completedFeeEach, 0);
        assert.equal(financialReport(after).circulation.difference, 0);
        checks.push(
          "Hosted existing allocator: two dedicated nine-card purchases, idempotent receipts, opened cards, zero balances",
        );
        checks.push(
          "Hosted server-time free window: both ownership transfers and zero fees committed together inside rollback acceptance",
        );
        await assert.rejects(
          () =>
            tx.savepoint(async (t) => {
              await t`set local role authenticated`;
              await t`select document from credits_sandbox.state`;
            }),
          /permission/,
        );
        await assert.rejects(
          () =>
            store.execute(a, randomUUID(), {
              kind: "swap-window",
              start: now + 70000,
              end: now + 80000,
              reason: "Must reject ordinary member operator action",
            }),
          /MFA/,
        );
        checks.push(
          "Ordinary Data API role cannot read private wallet aggregate; member cannot set fee window",
        );
        throw Error("CREDIT_ONLY_EXPECTED_ROLLBACK");
      }),
      /CREDIT_ONLY_EXPECTED_ROLLBACK/,
    );
    assert.equal(await fingerprint(), before);
    writeFileSync(
      "docs/qa/credit-only/hosted-rollback.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          checks,
          unchangedFingerprint: before,
          noPersistentAwards: true,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message, e.actual?.message);
  process.exitCode = 1;
});
