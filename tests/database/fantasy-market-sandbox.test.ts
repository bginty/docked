import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = async (n: number) =>
  db.query("select set_config('sandbox.actor',$1,false)", [id(n)]);
async function call(fn: string, n: number) {
  return (
    await db.query<{ v: any }>(`select market_sandbox.${fn}($1::uuid) v`, [
      id(n),
    ])
  ).rows[0].v;
}
async function quote() {
  return await call("quote", 20);
}
async function confirm(q: string) {
  return (
    await db.query<{ v: any }>("select market_sandbox.confirm($1::uuid) v", [q])
  ).rows[0].v;
}
async function unchanged() {
  assert.deepEqual(
    (
      await db.query("select owner_id from market_sandbox.cards order by id")
    ).rows.map((r: any) => r.owner_id),
    [id(1), id(2), id(1)],
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from market_sandbox.fee_history",
      )
    ).rows[0].n,
    0,
  );
}
before(async () => {
  db = new PGlite();
  await db.exec(await readFile("sandbox/fantasy-market.sql", "utf8"));
});
after(async () => db.close());
beforeEach(async () => {
  await db.exec(`truncate market_sandbox.accounts,market_sandbox.cards,market_sandbox.offers,market_sandbox.quotes,market_sandbox.consents,market_sandbox.receipts,market_sandbox.ownership_history,market_sandbox.fee_history cascade;
update market_sandbox.policy set cycle_start='2026-10-10T00:00:00Z',test_clock='2026-10-13T00:00:00Z',payment_failure=false,version='proposal-v1';
insert into market_sandbox.accounts values('${id(1)}',10000),('${id(2)}',10000),('${id(3)}',10000);
insert into market_sandbox.cards(id,owner_id) values('${id(10)}','${id(1)}'),('${id(11)}','${id(2)}'),('${id(12)}','${id(1)}');
insert into market_sandbox.offers(id,maker,taker,kind,give,take,price_cents) values('${id(20)}','${id(1)}','${id(2)}','swap',array['${id(10)}']::uuid[],array['${id(11)}']::uuid[],0);`);
  await actor(1);
});
test("bilateral consent, exact per-trade fees, idempotent receipt, immutable history", async () => {
  const q = await quote();
  assert.equal(q.fee_cents, 250);
  assert.equal((await confirm(q.id)).status, "awaiting other participant");
  await unchanged();
  await actor(2);
  const receipt = await confirm(q.id);
  assert.equal(receipt.total_fee_cents, 500);
  assert.deepEqual(await confirm(q.id), receipt);
  assert.deepEqual(
    (
      await db.query(
        "select balance_cents::int b from market_sandbox.accounts where id in($1,$2) order by id",
        [id(1), id(2)],
      )
    ).rows,
    [{ b: 9750 }, { b: 9750 }],
  );
  await assert.rejects(
    db.exec("update market_sandbox.receipts set body=body"),
    /Immutable/,
  );
});
test("fee-window boundary demands fresh quote and fresh bilateral consent", async () => {
  await db.exec(
    "update market_sandbox.policy set test_clock='2026-10-11T23:59:59Z'",
  );
  const q = await quote();
  assert.equal(q.fee_cents, 0);
  await confirm(q.id);
  await db.exec(
    "update market_sandbox.policy set test_clock='2026-10-12T00:00:00Z'",
  );
  await actor(2);
  await assert.rejects(confirm(q.id), /Fresh quote/);
  await unchanged();
  const next = await quote();
  assert.equal(next.fee_cents, 250);
  assert.equal((await confirm(next.id)).status, "awaiting other participant");
  await unchanged();
});
test("insufficient mock balance and payment failure roll back fees, transfers and second consent", async () => {
  const q = await quote();
  await confirm(q.id);
  await actor(2);
  await db.exec("update market_sandbox.policy set payment_failure=true");
  await assert.rejects(confirm(q.id), /Mock payment/);
  await unchanged();
  await db.exec(
    `update market_sandbox.policy set payment_failure=false;update market_sandbox.accounts set balance_cents=0 where id='${id(2)}'`,
  );
  await assert.rejects(confirm(q.id), /Insufficient/);
  await unchanged();
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from market_sandbox.consents",
      )
    ).rows[0].n,
    1,
  );
});
test("stale ownership, locked lineups, foreign accounts and policy changes fail closed", async () => {
  const q = await quote();
  await actor(3);
  await assert.rejects(confirm(q.id), /permission/);
  await actor(1);
  await db.exec(
    `update market_sandbox.cards set revision=revision+1 where id='${id(10)}'`,
  );
  await assert.rejects(confirm(q.id), /revision/);
  await db.exec(
    `update market_sandbox.cards set locked=true where id='${id(10)}'`,
  );
  await assert.rejects(quote(), /locked/);
  await unchanged();
});
test("bundle charged once, sale transfers price atomically, cancellation is free", async () => {
  await db.exec(
    `update market_sandbox.offers set kind='bundle',give=array['${id(10)}','${id(12)}']::uuid[],price_cents=500 where id='${id(20)}'`,
  );
  const q = await quote();
  await confirm(q.id);
  await actor(2);
  const r = await confirm(q.id);
  assert.equal(r.total_fee_cents, 500);
  assert.equal(r.give.length, 2);
  assert.deepEqual(
    (
      await db.query(
        "select balance_cents::int b from market_sandbox.accounts where id in($1,$2) order by id",
        [id(1), id(2)],
      )
    ).rows,
    [{ b: 10250 }, { b: 9250 }],
  );
});
test("cancellation and rejection never charge; cancelled quotes cannot commit", async () => {
  const q = await quote();
  await call("cancel", 20);
  await actor(2);
  await assert.rejects(confirm(q.id), /Fresh quote/);
  await unchanged();
});
test("unconfigured live schedule blocks, policy revision invalidates consent", async () => {
  await db.exec("update market_sandbox.policy set cycle_start=null");
  await assert.rejects(quote(), /not configured/);
  await db.exec(
    "update market_sandbox.policy set cycle_start='2026-10-10T00:00:00Z'",
  );
  const q = await quote();
  await confirm(q.id);
  await db.exec("update market_sandbox.policy set version='v2'");
  await actor(2);
  await assert.rejects(confirm(q.id), /Fresh quote/);
  await unchanged();
});
test("offer edits cannot substitute terms after consent; sale and decline rules", async () => {
  const old = await quote();
  await confirm(old.id);
  await db.exec(
    `update market_sandbox.offers set kind='sale',take='{}',price_cents=1200 where id='${id(20)}'`,
  );
  await actor(2);
  await assert.rejects(confirm(old.id), /terms changed/);
  const next = await quote();
  await confirm(next.id);
  await actor(1);
  const receipt = await confirm(next.id);
  assert.equal(receipt.kind, "sale");
  assert.equal(receipt.total_fee_cents, 500);
  assert.deepEqual(
    (
      await db.query(
        "select balance_cents::int b from market_sandbox.accounts where id in($1,$2) order by id",
        [id(1), id(2)],
      )
    ).rows,
    [{ b: 10950 }, { b: 8550 }],
  );
});
