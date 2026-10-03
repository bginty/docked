import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { rateLimitedAction } from "../../src/core/rate-limited-action";
import { rateLimitQuery } from "../../src/server/rate-limit-query";

test("single-connection action consumes durable quota before transaction and retains rejected attempts", async () => {
  const pg = new PGlite();
  await pg.exec(
    "create schema private;create table private.rate_limits(key text primary key,count integer not null,reset_at timestamptz not null);create table work(value text)",
  );
  let leased = false,
    actions = 0;
  const consume = async (key: string, limit: number, seconds: number) => {
    assert.equal(
      leased,
      false,
      "global limiter must never reacquire the sole leased connection",
    );
    leased = true;
    try {
      return (
        (await pg.query<{ count: number }>(rateLimitQuery, [key, seconds]))
          .rows[0].count <= limit
      );
    } finally {
      leased = false;
    }
  };
  const action =
    (reject = false) =>
    async () => {
      assert.equal(
        leased,
        false,
        "business transaction acquires the released connection",
      );
      leased = true;
      try {
        await pg.exec("begin");
        actions++;
        await pg.query("insert into work values($1)", ["auth-checked action"]);
        if (reject) throw Error("Business validation rejected");
        await pg.exec("commit");
        return "saved";
      } catch (error) {
        await pg.exec("rollback");
        throw error;
      } finally {
        leased = false;
      }
    };
  const budget = { scope: "notifications", limit: 2, seconds: 60 };
  try {
    await assert.rejects(
      () => rateLimitedAction("verified-user-a", budget, consume, action(true)),
      /Business validation rejected/,
    );
    assert.equal(
      (
        await pg.query<{ count: number }>(
          "select count from private.rate_limits",
        )
      ).rows[0].count,
      1,
    );
    assert.equal(
      (await pg.query<{ n: number }>("select count(*)::int n from work"))
        .rows[0].n,
      0,
    );
    assert.equal(
      await rateLimitedAction("verified-user-a", budget, consume, action()),
      "saved",
    );
    await assert.rejects(
      () => rateLimitedAction("verified-user-a", budget, consume, action()),
      /Action rate limit/,
    );
    assert.equal(
      actions,
      2,
      "over-budget request never enters business transaction",
    );
    assert.equal(
      (
        await pg.query<{ count: number }>(
          "select count from private.rate_limits",
        )
      ).rows[0].count,
      3,
    );
    await rateLimitedAction("verified-user-b", budget, consume, action());
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from private.rate_limits",
        )
      ).rows[0].n,
      2,
      "budget is scoped to verified account identity",
    );
    await pg.exec(
      "update private.rate_limits set reset_at=now()-interval '1 second'",
    );
    await rateLimitedAction("verified-user-a", budget, consume, action());
    assert.equal(
      (
        await pg.query<{ count: number }>(
          "select count from private.rate_limits where key='notifications:verified-user-a'",
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await pg.close();
  }
});
