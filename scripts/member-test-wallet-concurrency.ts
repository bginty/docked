import assert from "node:assert/strict";
import postgres from "postgres";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import {
  initialMemberTestCredits,
  barryGrantReference,
  memberTestView,
} from "../src/core/member-test-wallet";
import { wallet } from "../src/core/credits-sandbox";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL!;
  assert.match(new URL(url).hostname, /^(127\.0\.0\.1|localhost)$/);
  assert.match(new URL(url).pathname, /docked_free_play_test_/);
  const sql = postgres(url, { max: 8, onnotice: () => {} }),
    runtime = postgres(url, {
      max: 8,
      connection: { options: "-c role=docked_beta_app" },
      onnotice: () => {},
    });
  try {
    await sql.unsafe(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;create role docked_beta_app;",
    );
    await sql.unsafe(
      await readFile(
        "supabase/migrations/20261011100229_financial_test_wallet.sql",
        "utf8",
      ),
    );
    const s = initialMemberTestCredits();
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(s as any)})`;
    const store = new CreditsSandboxStore(sql),
      actor = { id: "owner", role: "reviewer", aal: "aal2" } as const,
      member = { id: "barry", role: "member" } as const;
    const grant = {
      kind: "promotion",
      member: member.id,
      amount: 100000,
      campaign: "barry-one-time",
      reason: "Owner authorised exactly 100000 non-withdrawable TEST credits",
      confirmed: true,
      redeemable: false,
    };
    await Promise.all(
      Array.from({ length: 20 }, () =>
        store.execute(actor, barryGrantReference, grant),
      ),
    );
    assert.equal(wallet(await store.read(), "barry").available, 100000);
    assert.equal(
      (await runtime`select current_user name`)[0].name,
      "docked_beta_app",
    );
    const memberStore = new CreditsSandboxStore(runtime);
    await assert.rejects(
      () => runtime`update credits_sandbox.access set enabled=true`,
      /permission/,
    );
    await assert.rejects(
      () => runtime`delete from credits_sandbox.journal`,
      /permission/,
    );
    const outcomes = await Promise.allSettled(
      Array.from({ length: 24 }, (_, i) =>
        memberStore.execute(member, "buy-" + i, {
          kind: "buy-pack",
          product: "premium-single-v1",
          policy: s.policy.version,
          confirmed: true,
        }),
      ),
    );
    assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 20);
    const after = await store.read();
    assert.equal(wallet(after, "barry").available, 2000);
    assert.equal(wallet(after, "barry").withdrawable, 0);
    assert.equal(Object.keys(after.entitlements).length, 20);
    const id = Object.keys(after.entitlements)[0];
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        memberStore.execute(member, "open-" + i, {
          kind: "open-pack",
          entitlement: id,
        }),
      ),
    );
    const done = await store.read();
    assert.equal(Object.keys(done.cards).length, 1);
    assert.equal(memberTestView(done, "stranger", []).cards.length, 0);
    for (const role of ["anon", "authenticated", "service_role"])
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx.unsafe("set local role " + role);
            await tx`select * from credits_sandbox.state`;
          }),
        /permission/,
      );
    await mkdir("docs/qa/android-v20", { recursive: true });
    await writeFile(
      "docs/qa/android-v20/test-wallet-postgres.json",
      JSON.stringify(
        {
          passed: true,
          scope: "Disposable real PostgreSQL; no hosted users",
          checks: [
            "20 duplicate grants = exactly 100000",
            "24 simultaneous purchases = 20 finite cards, 98000 debited",
            "20 opening retries = one card",
            "Ordinary projection hides other wallets and unopened inventory",
            "Runtime cannot change admission or delete journals",
            "Anonymous, authenticated and service roles cannot read schema",
            "Withdrawable balance remains zero",
          ],
        },
        null,
        2,
      ),
    );
    console.log("Member test-wallet PostgreSQL PASS");
  } finally {
    await runtime.end();
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
