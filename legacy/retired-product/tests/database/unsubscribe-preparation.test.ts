import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { TransactionSql } from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { prepareOutboxUnsubscribe } from "../../src/server/unsubscribe-preparation";
import { hash } from "../../src/core/pricing";
import { leaseOutboxRecord } from "../../src/server/outbox-lease";
let pg: PGlite;
const member = "00000000-0000-4000-8000-000000000001",
  outbox = "00000000-0000-4000-8000-000000000002",
  lease = "00000000-0000-4000-8000-000000000003";
const input = {
  outboxId: outbox,
  userId: member,
  leaseToken: lease,
  secret: "isolated-test-secret-never-used-for-hosted-data",
};
// Execute the actual production helper's parameterised tagged queries in isolated PostgreSQL.
const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) =>
  (
    await pg.query(
      strings.reduce((sql, part, i) => sql + (i ? `$${i}` : "") + part, ""),
      values,
    )
  ).rows) as unknown as TransactionSql;
before(async () => {
  pg = new PGlite();
  await pg.exec(
    `create schema private;create table public.profiles(id uuid primary key,timezone text,disabled_at timestamptz);create table private.outbox(id uuid primary key,user_id uuid,state text,lease_token uuid,lease_until timestamptz,expires_at timestamptz,attempts int not null default 0,available_at timestamptz not null default now(),created_at timestamptz not null default now());create table private.unsubscribe_tokens(token_hash text primary key,user_id uuid);insert into public.profiles values('${member}','Australia/Sydney',null);insert into private.outbox(id,user_id,state,lease_token,lease_until,expires_at) values('${outbox}','${member}','leased','${lease}',now()+interval '1 hour',now()+interval '2 hours');`,
  );
});
test("scoped normal leasing touches only the requested queued notification and preserves ordinary leasing", async () => {
  await pg.exec("begin");
  try {
    const first = "00000000-0000-4000-8000-000000000011";
    const second = "00000000-0000-4000-8000-000000000012";
    await pg.query(
      "insert into private.outbox(id,user_id,state,expires_at,created_at) values($1,$3,'queued',now()+interval '1 hour',now()-interval '1 minute'),($2,$3,'queued',now()+interval '1 hour',now())",
      [first, second, member],
    );
    const scoped = await leaseOutboxRecord(tx, second);
    assert.equal(scoped?.id, second);
    assert.equal(scoped?.attempts, 1);
    assert.match(scoped?.lease_token, /^[a-f0-9-]{36}$/);
    assert.equal(await leaseOutboxRecord(tx, second), null);
    assert.equal(
      await leaseOutboxRecord(tx, "00000000-0000-4000-8000-000000000099"),
      null,
    );
    assert.equal(
      (
        await pg.query<{ state: string }>(
          "select state from private.outbox where id=$1",
          [first],
        )
      ).rows[0].state,
      "queued",
    );
    const normal = await leaseOutboxRecord(tx);
    assert.equal(normal?.id, first);
    await pg.query(
      "update private.outbox set lease_until=now()-interval '1 second' where id=$1",
      [second],
    );
    const retry = await leaseOutboxRecord(tx, second);
    assert.equal(retry?.attempts, 2);
    assert.notEqual(retry?.lease_token, scoped?.lease_token);
    await pg.query("update private.outbox set state='suppressed' where id=$1", [
      second,
    ]);
    assert.equal(await leaseOutboxRecord(tx, second), null);
  } finally {
    await pg.exec("rollback");
  }
});
after(async () => {
  await pg?.close();
});
test("normal preparation persists a stable hashed unsubscribe capability without delivery", async () => {
  const first = await prepareOutboxUnsubscribe(tx, input),
    retry = await prepareOutboxUnsubscribe(tx, input);
  assert.ok(first);
  assert.equal(retry?.token, first.token);
  const rows = (
    await pg.query<{ token_hash: string; user_id: string }>(
      "select * from private.unsubscribe_tokens",
    )
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, hash(first.token));
  assert.equal(rows[0].user_id, member);
  assert.notEqual(rows[0].token_hash, first.token);
});
test("preparation cannot mint tokens for another user, wrong/expired lease, expired outbox or disabled member", async () => {
  assert.equal(
    await prepareOutboxUnsubscribe(tx, {
      ...input,
      userId: "00000000-0000-4000-8000-000000000004",
    }),
    null,
  );
  assert.equal(
    await prepareOutboxUnsubscribe(tx, {
      ...input,
      leaseToken: "00000000-0000-4000-8000-000000000004",
    }),
    null,
  );
  for (const change of [
    "update private.outbox set lease_until=now()-interval '1 second'",
    "update private.outbox set expires_at=now()-interval '1 second'",
    "update private.outbox set state='suppressed'",
    "update public.profiles set disabled_at=now()",
  ]) {
    await pg.exec("begin");
    try {
      await pg.exec(change);
      assert.equal(await prepareOutboxUnsubscribe(tx, input), null);
    } finally {
      await pg.exec("rollback");
    }
  }
  await assert.rejects(
    () => prepareOutboxUnsubscribe(tx, { ...input, secret: "weak" }),
    /dedicated unsubscribe secret/,
  );
  assert.equal(
    (await pg.query("select * from private.unsubscribe_tokens")).rows.length,
    1,
  );
});
