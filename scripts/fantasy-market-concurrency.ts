// Disposable loopback PostgreSQL only; never uses Docked's hosted DB variables.
import postgres from "postgres";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const url = new URL(process.env.FANTASY_TEST_DATABASE_URL ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.match(url.pathname, /^\/docked_free_play_test_\d+$/);
const db = postgres(url.href, { max: 8, onnotice: () => {} });
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const checks: string[] = [];
async function run(actor: number, fn: string, key: string) {
  return db.begin(async (tx) => {
    await tx`set local role sandbox_runtime`;
    await tx`select set_config('sandbox.actor',${id(actor)},true)`;
    return (
      await tx.unsafe(`select market_sandbox.${fn}($1::uuid) v`, [key])
    )[0].v;
  });
}
async function main() {
  try {
    await db.unsafe(await readFile("sandbox/fantasy-market.sql", "utf8"));
    await db.unsafe(`create role sandbox_runtime;grant usage on schema market_sandbox to sandbox_runtime;grant execute on function market_sandbox.quote(uuid),market_sandbox.confirm(uuid),market_sandbox.cancel(uuid,boolean) to sandbox_runtime;
 update market_sandbox.policy set cycle_start='2026-10-10T00:00Z',test_clock='2026-10-13T00:00Z';
 insert into market_sandbox.accounts values('${id(1)}',10000),('${id(2)}',10000),('${id(3)}',10000);
 insert into market_sandbox.cards(id,owner_id) values('${id(10)}','${id(1)}'),('${id(11)}','${id(2)}');
 insert into market_sandbox.offers(id,maker,taker,kind,give,take,price_cents) values('${id(20)}','${id(1)}','${id(2)}','swap',array['${id(10)}']::uuid[],array['${id(11)}']::uuid[],0),('${id(21)}','${id(1)}','${id(2)}','swap',array['${id(10)}']::uuid[],array['${id(11)}']::uuid[],0);`);
    const [a, b] = await Promise.all([
      run(1, "quote", id(20)),
      run(1, "quote", id(21)),
    ]);
    await Promise.all([run(1, "confirm", a.id), run(1, "confirm", b.id)]);
    const raced = await Promise.allSettled([
      run(2, "confirm", a.id),
      run(2, "confirm", b.id),
    ]);
    assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
    checks.push("Competing offers: exactly one transfers ownership");
    const accepted = raced[0].status === "fulfilled" ? a : b;
    const repeated = await Promise.all(
      Array.from({ length: 8 }, () => run(2, "confirm", accepted.id)),
    );
    assert.ok(repeated.every((r) => r.quote_id === accepted.id));
    assert.equal(
      (await db`select count(*)::int n from market_sandbox.receipts`)[0].n,
      1,
    );
    assert.equal(
      (
        await db`select count(*)::int n from market_sandbox.ownership_history`
      )[0].n,
      2,
    );
    assert.equal(
      (await db`select sum(cents)::int n from market_sandbox.fee_history`)[0].n,
      500,
    );
    checks.push(
      "Eight duplicate confirms return one receipt; two ownership events; exactly AUD5",
    );
    await assert.rejects(run(3, "confirm", accepted.id), /permission/);
    checks.push("Foreign account denied");
    await assert.rejects(
      db.begin(async (tx) => {
        await tx`set local role sandbox_runtime`;
        await tx`update market_sandbox.accounts set balance_cents=999999`;
      }),
      /permission/,
    );
    checks.push("Restricted runtime cannot change balances or bypass RPC");
    await assert.rejects(
      db`update market_sandbox.ownership_history set at=clock_timestamp()`,
      /Immutable/,
    );
    checks.push("Ownership audit immutable even to operator");
    await mkdir("docs/qa/fantasy-ux", { recursive: true });
    await writeFile(
      "docs/qa/fantasy-ux/market-concurrency.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          scope:
            "local disposable PostgreSQL 17; mock balances and synthetic cards only",
          passed: true,
          checks,
        },
        null,
        2,
      ),
    );
    console.log(
      `${checks.length} real PostgreSQL sandbox concurrency/security checks passed`,
    );
  } finally {
    await db.end();
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
