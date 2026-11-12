import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  historicalWarningSql,
  validateHistoricalWarnings,
} from "../../scripts/lib/historical-warning-disposition";

const fixture = () =>
  Array.from({ length: 7 }, (_, i) => ({
    id: `isolated-notification-${i}`,
    receipt_key: (i < 2 ? "a" : i < 5 ? "b" : "c").repeat(64),
    kind: i % 2 ? "voided" : "purchase",
    occurred_at: 1793877442000 + i,
    state: "attention",
    attempts: 12,
    lease_until: null,
    next_attempt_at: "2026-11-05T12:00:00+00:00",
    last_error: "Original test verification unavailable",
    created_at: "2026-11-05T11:17:22+00:00",
    completed_at: null,
  }));
async function database() {
  const db = new PGlite();
  await db.exec(`create schema credits_sandbox;create schema commercial_billing;create schema private;
    create table credits_sandbox.store_notifications(id text primary key,receipt_key text,kind text,occurred_at bigint,state text,attempts int,lease_until timestamptz,next_attempt_at timestamptz,last_error text,created_at timestamptz,completed_at timestamptz);
    create table commercial_billing.control(id boolean primary key,environment text,sales_enabled boolean,issuance_enabled boolean,transfers_enabled boolean,gameplay_enabled boolean);
    insert into commercial_billing.control values(true,'commercial',false,false,false,false);
    create table commercial_billing.products(approved boolean);insert into commercial_billing.products values(false);
    create table private.audit_events(actor text,action text,subject text,details jsonb);
    create function private.immutable() returns trigger language plpgsql as $$begin raise exception 'Append-only evidence';end$$;
    create trigger immutable before update or delete on private.audit_events for each row execute function private.immutable();`);
  const rows = fixture();
  await db.query(
    "insert into credits_sandbox.store_notifications select * from jsonb_populate_recordset(null::credits_sandbox.store_notifications,$1)",
    [JSON.stringify(rows)],
  );
  await db.exec(
    "insert into credits_sandbox.store_notifications(id,state,attempts) values('unrelated','pending',3)",
  );
  return { db, rows };
}
const proposal = (rows: unknown) =>
  historicalWarningSql({
    rows,
    approvalReference: "ISOLATED TEST ONLY; NO PRODUCTION APPROVAL",
    packageSha256: "d".repeat(64),
    evidenceSha256: "e".repeat(64),
    manifestSha256: "f".repeat(64),
  });

test("historical warning disposition preserves exact payloads and unrelated rows with an immutable explanatory audit", async () => {
  const { db, rows } = await database();
  try {
    const before = (
      await db.query<{ v: Record<string, unknown> }>(
        "select to_jsonb(n)-'state'-'completed_at'-'lease_until' v from credits_sandbox.store_notifications n order by id",
      )
    ).rows;
    await db.exec("begin;" + proposal(rows) + "commit;");
    const after = (
      await db.query<{ v: Record<string, unknown> }>(
        "select to_jsonb(n)-'state'-'completed_at'-'lease_until' v from credits_sandbox.store_notifications n order by id",
      )
    ).rows;
    assert.deepEqual(after, before);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from credits_sandbox.store_notifications where state='done' and completed_at is not null",
        )
      ).rows[0].n,
      7,
    );
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select state from credits_sandbox.store_notifications where id='unrelated'",
        )
      ).rows[0].state,
      "pending",
    );
    const audit = (
      await db.query<{ actor: string; details: any }>(
        "select * from private.audit_events",
      )
    ).rows[0];
    assert.equal(audit.actor, "operator:codex");
    assert.equal(
      audit.details.meaning,
      "externally reconciled original Preview TEST; not a Production fulfilment",
    );
    assert.equal(audit.details.originalPreviewRecoveryHoldCredits, 5700);
    assert.equal(audit.details.before.length, 7);
    assert.equal(audit.details.after.length, 7);
    assert.equal(audit.details.walletMutation, false);
    await assert.rejects(
      db.exec("update private.audit_events set action='erased'"),
      /Append-only/,
    );
    await assert.rejects(
      db.exec("delete from private.audit_events"),
      /Append-only/,
    );
    await assert.rejects(
      db.exec("begin;" + proposal(rows) + "commit;"),
      /baseline/,
    );
    await db.exec("rollback");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from private.audit_events",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

for (const [label, change, expected] of [
  [
    "payload drift",
    "update credits_sandbox.store_notifications set attempts=13 where id='isolated-notification-0'",
    /baseline/,
  ],
  [
    "active lease",
    "update credits_sandbox.store_notifications set lease_until=clock_timestamp()+interval '1 hour' where id='isolated-notification-0'",
    /baseline/,
  ],
  [
    "commercial gate open",
    "update commercial_billing.control set sales_enabled=true",
    /Closed commercial/,
  ],
  [
    "product approved",
    "update commercial_billing.products set approved=true",
    /Unapproved products/,
  ],
  [
    "audit disabled",
    "alter table private.audit_events disable trigger immutable",
    /Immutable audit/,
  ],
] as const)
  test(`historical warning correction refuses ${label} and rolls back`, async () => {
    const { db, rows } = await database();
    try {
      await db.exec(change);
      const before = (
        await db.query(
          "select * from credits_sandbox.store_notifications order by id",
        )
      ).rows;
      await assert.rejects(
        db.exec("begin;" + proposal(rows) + "commit;"),
        expected,
      );
      await db.exec("rollback");
      assert.deepEqual(
        (
          await db.query(
            "select * from credits_sandbox.store_notifications order by id",
          )
        ).rows,
        before,
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from private.audit_events",
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await db.close();
    }
  });

test("warning manifest rejects duplicate IDs, extra rows, unexpected status and changed receipt grouping", () => {
  const rows = fixture();
  assert.equal(validateHistoricalWarnings(rows).length, 7);
  assert.throws(() => validateHistoricalWarnings([...rows, rows[0]]));
  assert.throws(() =>
    validateHistoricalWarnings(rows.map((r) => ({ ...r, id: rows[0].id }))),
  );
  assert.throws(() =>
    validateHistoricalWarnings(rows.map((r) => ({ ...r, state: "done" }))),
  );
  assert.throws(() =>
    validateHistoricalWarnings(
      rows.map((r) => ({ ...r, receipt_key: "a".repeat(64) })),
    ),
  );
});
