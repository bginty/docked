import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
let pg: PGlite;
const file =
  "config/production-email/supabase/migrations/20261008121711_docked_auth_email_outbox.sql";
const job = (id: string) => ({
  id: id.repeat(64),
  fingerprint: "f".repeat(64),
  envelope: { version: 1, iv: "authored", ciphertext: "authored" },
});
async function rpc(action: string, data: object) {
  return (
    await pg.query<{ r: any }>(
      "select public.docked_mail_queue($1,$2::jsonb) r",
      [action, JSON.stringify({ mode: "controlled", ...data })],
    )
  ).rows[0].r;
}
before(async () => {
  pg = new PGlite();
  await pg.exec(
    "create role anon;create role authenticated;create role service_role;create role docked_app;",
  );
  await pg.exec(await readFile(file, "utf8"));
});
after(async () => await pg.close());
test("mail RPC and encrypted tables are unavailable to public/member/runtime roles", async () => {
  for (const role of ["anon", "authenticated", "docked_app"]) {
    await pg.exec("set role " + role);
    await assert.rejects(
      () => rpc("enqueue", { jobs: [job("1")] }),
      /permission denied/,
    );
    await assert.rejects(
      () => pg.query("select * from private.docked_auth_mail_outbox"),
      /permission denied/,
    );
    await pg.exec("reset role");
  }
  await pg.exec("set role service_role");
  assert.equal(
    (await rpc("enqueue", { jobs: [job("1")] }))[0].state,
    "pending",
  );
  await assert.rejects(
    () => pg.query("select * from private.docked_auth_mail_outbox"),
    /permission denied/,
  );
  await pg.exec("reset role");
});
test("duplicate enqueues reuse one receipt; conflicting content and partial batches roll back", async () => {
  const input = job("2");
  await rpc("enqueue", { jobs: [input] });
  await rpc("enqueue", {
    jobs: [{ ...input, envelope: { version: 1, iv: "different" } }],
  });
  await assert.rejects(
    () =>
      rpc("enqueue", {
        jobs: [job("3"), { ...input, fingerprint: "a".repeat(64) }],
      }),
    /idempotency conflict/,
  );
  assert.equal(await rpc("status", { id: job("3").id }), null);
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from private.docked_auth_mail_outbox where id=$1",
        [input.id],
      )
    ).rows[0].n,
    1,
  );
});
test("worker fencing prevents a second claim and a stale worker dispatch", async () => {
  const input = job("4"),
    worker = randomUUID();
  await rpc("enqueue", { jobs: [input] });
  await rpc("claim", { id: input.id, worker });
  assert.equal(
    await rpc("claim", { id: input.id, worker: randomUUID() }),
    null,
  );
  await assert.rejects(
    () => rpc("dispatch", { id: input.id, worker: randomUUID() }),
    /lease unavailable/,
  );
  assert.equal(
    (await rpc("dispatch", { id: input.id, worker })).dispatched,
    true,
  );
  await assert.rejects(
    () => rpc("dispatch", { id: input.id, worker }),
    /cannot dispatch/,
  );
  await rpc("settle", { id: input.id, worker, state: "accepted", code: "202" });
  assert.equal(
    await rpc("claim", { id: input.id, worker: randomUUID() }),
    null,
  );
  assert.equal(
    (
      await pg.query<{ envelope: any }>(
        "select envelope from private.docked_auth_mail_outbox where id=$1",
        [input.id],
      )
    ).rows[0].envelope,
    null,
  );
});
test("lost dispatch acknowledgement becomes unknown and can never auto retry", async () => {
  const input = job("5"),
    worker = randomUUID();
  await rpc("enqueue", { jobs: [input] });
  await rpc("claim", { id: input.id, worker });
  await rpc("dispatch", { id: input.id, worker });
  await pg.query(
    "update private.docked_auth_mail_outbox set lease_until=clock_timestamp()-interval '1 second' where id=$1",
    [input.id],
  );
  assert.equal((await rpc("status", { id: input.id })).state, "unknown");
  assert.equal(
    await rpc("claim", { id: input.id, worker: randomUUID() }),
    null,
  );
  await assert.rejects(
    () =>
      rpc("settle", {
        id: input.id,
        worker,
        state: "pending",
        code: "authorization",
      }),
    /lease unavailable/,
  );
});
test("only pre-dispatch failures can retry; attempts are bounded and accepted cannot be downgraded", async () => {
  const input = job("6");
  await rpc("enqueue", { jobs: [input] });
  for (let i = 0; i < 3; i++) {
    const worker = randomUUID();
    await rpc("claim", { id: input.id, worker });
    await rpc("settle", {
      id: input.id,
      worker,
      state: "pending",
      code: "authorization",
    });
    await pg.query(
      "update private.docked_auth_mail_outbox set available_at=clock_timestamp()-interval '1 second' where id=$1",
      [input.id],
    );
  }
  assert.equal((await rpc("status", { id: input.id })).state, "failed");
  assert.equal(
    await rpc("claim", { id: input.id, worker: randomUUID() }),
    null,
  );
  const id = job("4").id;
  await assert.rejects(
    () =>
      rpc("settle", {
        id,
        worker: randomUUID(),
        state: "pending",
        code: "authorization",
      }),
    /lease unavailable/,
  );
});
test("expired queued links are erased without dispatch and modes cannot cross", async () => {
  const input = job("7");
  await rpc("enqueue", { jobs: [input] });
  assert.equal(
    await rpc("claim", {
      id: input.id,
      mode: "production",
      worker: randomUUID(),
    }),
    null,
  );
  await pg.query(
    "update private.docked_auth_mail_outbox set expires_at=clock_timestamp()-interval '1 second' where id=$1",
    [input.id],
  );
  assert.equal(
    await rpc("claim", { id: input.id, worker: randomUUID() }),
    null,
  );
  assert.equal((await rpc("status", { id: input.id })).state, "expired");
});

test("live dispatch lease cannot return to pending for any retry reason", async () => {
  const input = job("8"),
    worker = randomUUID();
  await rpc("enqueue", { jobs: [input] });
  await rpc("claim", { id: input.id, worker });
  await rpc("dispatch", { id: input.id, worker });
  for (const code of ["authorization", "429", "ambiguous"])
    await assert.rejects(
      () => rpc("settle", { id: input.id, worker, state: "pending", code }),
      /Invalid mail/,
    );
  assert.equal((await rpc("status", { id: input.id })).state, "dispatching");
});
