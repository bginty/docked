import assert from "node:assert/strict";
import postgres from "postgres";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { creditsFixture, alice, bob, owner, provider } from "./credits-fixture";
import {
  wallet,
  financialReport,
  validateCredits,
} from "../src/core/credits-sandbox";
import { creditsPolicy } from "../src/core/credits-policy";
import { runCreditsReview } from "./credits-review-server";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  if (
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_free_play_test_\d+$/.test(
      url,
    )
  )
    throw Error("Disposable loopback only");
  const sql = postgres(url, { max: 24 }),
    checks: string[] = [];
  try {
    const schema = await readFile("sandbox/credits.sql", "utf8");
    await sql.unsafe(schema);
    await sql`create table public.friends_sentinel(id integer primary key, note text)`;
    await sql`insert into public.friends_sentinel values(1,'unchanged free beta test sentinel')`;
    const state = creditsFixture(4);
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(state as any)})`;
    const store = new CreditsSandboxStore(sql);
    const run = store.execute.bind(store);
    for (const [member, product, prefix, n] of [
      [alice, "premium-single-v1", "a", 4900],
      [bob, "elite-single-v1", "b", 9900],
    ] as const) {
      await run(member, `${prefix}dep`, { kind: "deposit", product });
      await run(provider, `${prefix}bind`, {
        kind: "bind",
        deposit: `${prefix}dep`,
        providerOrder: `PP${prefix}`,
      });
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          run(provider, `${prefix}capture${i}`, {
            kind: "capture",
            deposit: `${prefix}dep`,
            event: `EV${prefix}${i}`,
            providerOrder: `PP${prefix}`,
            capture: `CAP${prefix}`,
            amount: n,
            currency: "AUD",
            verified: true,
          }),
        ),
      );
      assert.equal(wallet(await store.read(), member.id).pending, n);
      await Promise.all(
        Array.from({ length: 20 }, () =>
          run(provider, `${prefix}clear`, {
            kind: "clear",
            deposit: `${prefix}dep`,
          }),
        ),
      );
      assert.equal(wallet(await store.read(), member.id).available, n);
      await Promise.all(
        Array.from({ length: 20 }, () =>
          run(member, `${prefix}open`, {
            kind: "open-pack",
            entitlement: `${prefix}dep`,
          }),
        ),
      );
    }
    checks.push(
      "Both exact deposits; 20 duplicate/out-of-order capture notifications and clears; one unopened bonus then one card per member",
    );
    let s = await store.read();
    const ac = s.commerce.orders.adep.card,
      bc = s.commerce.orders.bdep.card;
    await run(alice, "swap", {
      kind: "offer",
      other: bob.id,
      give: [ac],
      take: [bc],
      feeEach: 50,
    });
    const beforeFailedSwap = await store.read();
    await sql.unsafe(
      "create function credits_sandbox.fail() returns trigger language plpgsql as $$begin raise exception 'injected persistence failure';end$$;create trigger injected before insert on credits_sandbox.history for each row execute function credits_sandbox.fail()",
    );
    await assert.rejects(
      () => run(bob, "accept", { kind: "accept", swap: "swap" }),
      /injected/,
    );
    s = await store.read();
    assert.deepEqual(s, beforeFailedSwap);
    assert.equal(s.commerce.cards[ac].owner, alice.id);
    assert.equal(wallet(s, alice.id).available, 4900);
    await sql.unsafe("drop trigger injected on credits_sandbox.history");
    await Promise.all(
      Array.from({ length: 20 }, () =>
        run(bob, "accept", { kind: "accept", swap: "swap" }),
      ),
    );
    s = await store.read();
    assert.equal(s.commerce.cards[ac].owner, bob.id);
    assert.equal(s.commerce.cards[bc].owner, alice.id);
    assert.equal(financialReport(s).swapFees, 100);
    checks.push(
      "Swap rollback on persistence failure; 20 accept retries transfer both owners once and charge exactly 50 each",
    );
    await run(alice, "listing", { kind: "list", card: bc, price: 100 });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        run(bob, "buy", {
          kind: "buy",
          listing: "listing",
          expectedPrice: 100,
          policy: creditsPolicy.version,
          confirmed: true,
        }),
      ),
    );
    s = await store.read();
    assert.equal(financialReport(s).commission, 8);
    assert.equal(wallet(s, alice.id).withdrawable, 4850);
    checks.push(
      "20 sale retries; 7.5% half-up fee 8 on 100; restricted bonus resale remains non-redeemable",
    );
    const spending = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        run(bob, `pack${i}`, {
          kind: "buy-pack",
          product: "premium-single-v1",
          policy: creditsPolicy.version,
          confirmed: true,
        }),
      ),
    );
    assert.equal(spending.filter((x) => x.status === "fulfilled").length, 1);
    checks.push(
      "20 simultaneous purchases cannot overspend or duplicate entitlement",
    );
    await run(alice, "kyc", { kind: "kyc-start", session: "fixtureidentity" });
    await run(owner, "verify", {
      kind: "kyc-event",
      member: alice.id,
      session: "fixtureidentity",
      event: "identity1",
      revision: 1,
      state: "VERIFIED",
      expires: Date.now() + 3600000,
      reason: "Synthetic identity verification only",
    });
    await run(owner, "beneficiary", {
      kind: "beneficiary",
      member: alice.id,
      beneficiary: "fixturebank",
      verified: true,
      reason: "Synthetic beneficiary verified",
    });
    const ws = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        run(alice, `w${i}`, {
          kind: "withdraw",
          amount: 4000,
          beneficiary: "fixturebank",
          policy: creditsPolicy.version,
          confirmed: true,
        }),
      ),
    );
    assert.equal(ws.filter((x) => x.status === "fulfilled").length, 1);
    s = await store.read();
    const wid = Object.keys(s.withdrawals)[0];
    await run(owner, "review", {
      kind: "withdraw-review",
      withdrawal: wid,
      action: "approve",
      reason: "Synthetic withdrawal review",
    });
    await run(provider, "submit", {
      kind: "payout-submit",
      withdrawal: wid,
      provider: "PAYOUT1",
    });
    await run(provider, "uncertain", {
      kind: "payout-result",
      withdrawal: wid,
      provider: "PAYOUT1",
      event: "PAYOUT-EV1",
      status: "UNCERTAIN",
      verified: true,
    });
    await assert.rejects(() =>
      run(provider, "retry", {
        kind: "payout-submit",
        withdrawal: wid,
        provider: "PAYOUT2",
      }),
    );
    await run(provider, "failure", {
      kind: "payout-result",
      withdrawal: wid,
      provider: "PAYOUT1",
      event: "PAYOUT-EV2",
      status: "FAILED",
      verified: true,
    });
    assert.equal(wallet(await store.read(), alice.id).reserved, 0);
    checks.push(
      "20 withdrawal races reserve once; unknown payout never retried; conclusively failed payout releases reservation",
    );
    await assert.rejects(
      () => sql`delete from credits_sandbox.lines`,
      /immutable/,
    );
    await assert.rejects(
      () => sql`truncate credits_sandbox.lines`,
      /immutable/,
    );
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`insert into credits_sandbox.journal values('invalid','{}')`;
          await tx`insert into credits_sandbox.lines values('invalid',0,'test',1)`;
        }),
      /Unbalanced/,
    );
    await sql.unsafe(
      "create role credits_untrusted; grant usage on schema credits_sandbox to credits_untrusted",
    );
    for (const table of ["state", "history", "journal", "lines"])
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx`set local role credits_untrusted`;
            await tx.unsafe(`select * from credits_sandbox.${table}`);
          }),
        /permission/,
      );
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`set local role credits_untrusted`;
          await tx`insert into credits_sandbox.journal values('unauthorized','{}')`;
        }),
      /permission/,
    );
    await assert.rejects(
      () =>
        run(alice, "mint", {
          kind: "promotion",
          member: alice.id,
          amount: 100,
          campaign: "fake",
          reason: "Unauthorized mint request",
          confirmed: true,
          redeemable: false,
        }),
      /MFA/,
    );
    assert.equal(
      (await sql`select note from public.friends_sentinel where id=1`)[0].note,
      "unchanged free beta test sentinel",
    );
    s = await store.read();
    validateCredits(s);
    assert.equal(
      Number(
        (
          await sql`select coalesce(sum(credits),0) n from credits_sandbox.lines`
        )[0].n,
      ),
      0,
    );
    checks.push(
      "Immutable journal, deferred double-entry SQL constraint, untrusted-role denials and unchanged friends sentinel",
    );
    await mkdir("docs/qa/credits-v1", { recursive: true });
    const report = {
      at: new Date().toISOString(),
      passed: true,
      engine: (await sql`select version() v`)[0].v,
      scope:
        "Disposable loopback PostgreSQL; synthetic members/cards/funds. No external provider transactions.",
      schema: "sandbox/credits.sql",
      schemaHash: createHash("sha256")
        .update(schema.replaceAll("\r\n", "\n"))
        .digest("hex"),
      checks,
    };
    await writeFile(
      "docs/qa/credits-v1/postgres.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    await writeFile(
      "docs/qa/credits-v1/scenario.json",
      JSON.stringify(
        {
          alice: wallet(s, alice.id),
          bob: wallet(s, bob.id),
          admin: financialReport(s),
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify(report));
    await runCreditsReview(store, process.env.DOCKED_CREDITS_REVIEW === "true");
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
