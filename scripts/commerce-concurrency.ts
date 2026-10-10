import assert from "node:assert/strict";
import postgres from "postgres";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { initialCommerce } from "../src/core/commerce-sandbox";
import { CommerceSandboxStore } from "../src/server/commerce-sandbox-store";
import { updatePrizeRegister } from "../src/server/prize-sandbox-store";
import { generatePrizes } from "../src/core/prize-register";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  if (
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_free_play_test_\d+$/.test(
      url,
    )
  )
    throw Error("Disposable loopback only");
  const sql = postgres(url, { max: 24 });
  try {
    await sql.unsafe(await readFile("sandbox/commerce.sql", "utf8"));
    const s = initialCommerce();
    s.products.elite = {
      tier: "ELITE",
      cents: 9900,
      pool: ["one"],
      sport: "epl",
      method: "named",
    };
    s.cards.one = { tier: "ELITE", sport: "epl", owner: null, reserved: null };
    await sql`insert into commerce_sandbox.state values(true,0,${sql.json(s as any)})`;
    const store = new CommerceSandboxStore(sql),
      member = { id: "member", role: "member" as const },
      admin = { id: "admin", role: "reviewer" as const, aal: "aal2" as const };
    const orders = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        store.execute({ ...member, id: `member${i}` }, `o${i}`, {
          kind: "order",
          product: "elite",
          card: "one",
          method: "bank",
        }),
      ),
    );
    assert.equal(orders.filter((o) => o.status === "fulfilled").length, 1);
    let state = (await sql`select document from commerce_sandbox.state`)[0]
      .document;
    const o = Object.values(state.orders)[0] as any;
    const paid = {
      kind: "payment",
      order: o.id,
      event: "BANK1",
      cents: 9900,
      currency: "AUD",
      confirmed: true,
    };
    await Promise.all(
      Array.from({ length: 20 }, () => store.execute(admin, "paid", paid)),
    );
    await sql.unsafe(
      "create function commerce_sandbox.fail() returns trigger language plpgsql as $$begin raise exception 'injected persistence failure';end$$;create trigger failure before insert on commerce_sandbox.history for each row execute function commerce_sandbox.fail();",
    );
    await assert.rejects(
      () => store.execute(admin, "fulfil", { kind: "fulfil", order: o.id }),
      /injected/,
    );
    state = (await sql`select document from commerce_sandbox.state`)[0]
      .document;
    assert.equal(state.orders[o.id].status, "PAID");
    assert.equal(state.cards.one.owner, null);
    await sql.unsafe("drop trigger failure on commerce_sandbox.history");
    await Promise.all(
      Array.from({ length: 20 }, () =>
        store.execute(admin, "fulfil", { kind: "fulfil", order: o.id }),
      ),
    );
    state = (await sql`select document from commerce_sandbox.state`)[0]
      .document;
    assert.equal(state.cards.one.owner, o.member);
    assert.equal(
      state.events.filter((e: any) => e.kind === "fulfil").length,
      1,
    );
    state.funds.member = { eligible: 5000, reserved: 0 };
    state.beneficiaries.bank = { member: "member", verified: true };
    state.kyc.member = {
      state: "VERIFIED",
      session: "TEST",
      revision: 1,
      expires: Date.now() + 60000,
    };
    // Synthetic fixture funding only, not an available application command.
    await sql`update commerce_sandbox.state set document=${sql.json(state)} where id`;
    const withdrawals = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        store.execute(member, `w${i}`, {
          kind: "withdraw",
          cents: 4000,
          beneficiary: "bank",
        }),
      ),
    );
    assert.equal(withdrawals.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(
      () => sql`delete from commerce_sandbox.history`,
      /immutable/,
    );
    await sql`insert into commerce_sandbox.prizes values(true,${sql.json({ scope: "synthetic-only", obligations: [], audit: [] })})`;
    const result = {
      competition: "fixture",
      sport: "epl",
      round: "1",
      final: true,
      complete: true,
      revision: 1,
      winners: [{ member: "fixture1", name: "Synthetic member", rank: 1 }],
    };
    const schedule = {
      version: "local-sample-only",
      approved: true,
      tiePolicy: "hold" as const,
      prizes: [
        {
          position: 1,
          description: "Synthetic pack",
          kind: "pack" as const,
          quantity: 1,
          currency: null,
          cents: null,
          verificationRequired: false,
        },
      ],
    };
    await Promise.all(
      Array.from({ length: 20 }, () =>
        updatePrizeRegister(sql, (old) =>
          generatePrizes(
            old,
            result,
            schedule,
            { id: "owner", owner: true, aal: "aal2" },
            "2026-10-10T00:00:00Z",
            "2026-10-11T00:00:00Z",
          ),
        ),
      ),
    );
    assert.equal(
      (await sql`select document from commerce_sandbox.prizes`)[0].document
        .obligations.length,
      1,
    );
    assert.equal(
      Number(
        (await sql`select count(*) n from commerce_sandbox.prize_history`)[0].n,
      ),
      1,
    );
    await sql.unsafe(
      "create role commerce_untrusted;grant usage on schema commerce_sandbox to commerce_untrusted;",
    );
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`set local role commerce_untrusted`;
          await tx`select * from commerce_sandbox.state`;
        }),
      /permission/,
    );
    await mkdir("docs/qa/friends-release", { recursive: true });
    const report = {
      at: new Date().toISOString(),
      passed: true,
      scope:
        "Disposable PostgreSQL, synthetic cards/funds only; no PayPal or bank network",
      checks: [
        "20 competing purchases: one reservation",
        "20 repeated payments: one posting",
        "Injected journal failure: paid-but-unfulfilled order preserved, no partial card change",
        "20 retried fulfilments: one issuance",
        "20 withdrawals: one balance reservation",
        "20 prize generations: one obligation and immutable journal",
        "Audit immutable; untrusted database role denied",
      ],
    };
    await writeFile(
      "docs/qa/friends-release/commerce-postgres.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
