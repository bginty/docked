import test from "node:test";
import assert from "node:assert/strict";
import { assertOperationalDrift } from "../../scripts/lib/operational-drift";
import {
  readArchivedRows,
  textRowsQuery,
} from "../../scripts/lib/backup-row-review";
const early = "2026-01-01 00:00:00+00",
  late = "2026-01-02 00:00:00+00";
test("archived COPY preserves text/escapes and excludes generated fields from its header", () => {
  assert.deepEqual(
    readArchivedRows(
      "COPY auth.users (id, email) FROM stdin;\na\tname\\tvalue\n\\.\n",
      '"auth"."users"',
    ),
    [{ id: "a", email: "name\tvalue" }],
  );
  assert.match(
    textRowsQuery('"auth"."sessions"', [{ name: "ip", type: "inet" }]),
    /inet_out/,
  );
  assert.throws(() =>
    readArchivedRows(
      "COPY auth.users (id) FROM stdin;\na\tb\n\\.",
      '"auth"."users"',
    ),
  );
});
test("authentication drift allows only bound rotation, not credentials, permissions or new users", () => {
  const context = {
    sessions: [{ id: "s", user_id: "u" }],
    jobs: [],
    rotatedSessions: ["s"],
  };
  const old = [
    {
      id: "1",
      token: "old-token",
      user_id: "u",
      session_id: "s",
      instance_id: "i",
      parent: null,
      revoked: "f",
      created_at: early,
      updated_at: early,
    },
  ];
  const rows = [
    { ...old[0], revoked: "t", updated_at: late },
    {
      ...old[0],
      id: "2",
      token: "new-token",
      parent: "old-token",
      created_at: late,
      updated_at: late,
    },
  ];
  assertOperationalDrift('"auth"."refresh_tokens"', old, rows, context);
  assert.throws(() =>
    assertOperationalDrift(
      '"auth"."refresh_tokens"',
      old,
      [rows[0], { ...rows[1], user_id: "other" }],
      context,
    ),
  );
  assert.throws(() =>
    assertOperationalDrift(
      '"auth"."refresh_tokens"',
      old,
      [rows[0], { ...rows[1], parent: "new-token" }],
      context,
    ),
  );
  const user = { id: "u", encrypted_password: "test-hash", updated_at: early };
  assertOperationalDrift(
    '"auth"."users"',
    [user],
    [{ ...user, updated_at: late }],
    context,
  );
  assert.throws(() =>
    assertOperationalDrift(
      '"auth"."users"',
      [user],
      [{ ...user, encrypted_password: "changed" }],
      context,
    ),
  );
  assert.throws(() =>
    assertOperationalDrift(
      '"auth"."users"',
      [user],
      [user, { ...user, id: "other" }],
      context,
    ),
  );
  const session = {
    id: "s",
    user_id: "u",
    aal: "aal2",
    ip: "192.0.2.1",
    updated_at: early,
    refreshed_at: early,
  };
  const refreshed = {
    ...session,
    ip: "192.0.2.2",
    updated_at: late,
    refreshed_at: late,
  };
  assertOperationalDrift('"auth"."sessions"', [session], [refreshed], context);
  assert.throws(() =>
    assertOperationalDrift('"auth"."sessions"', [session], [refreshed], {
      ...context,
      rotatedSessions: [],
    }),
  );
  assert.throws(() =>
    assertOperationalDrift(
      '"auth"."sessions"',
      [session],
      [{ ...refreshed, aal: "aal1" }],
      context,
    ),
  );
});
test("scheduler drift cannot rewrite history, commands, configuration or issue inventory", () => {
  const context = {
    sessions: [],
    jobs: [
      {
        jobid: "1",
        command: "select tick()",
        database: "postgres",
        username: "worker",
      },
    ],
  };
  const old = {
    runid: "1",
    ...context.jobs[0],
    start_time: early,
    status: "succeeded",
  };
  const next = { ...old, runid: "2", start_time: late };
  assertOperationalDrift(
    '"cron"."job_run_details"',
    [old],
    [old, next],
    context,
  );
  assert.throws(() =>
    assertOperationalDrift(
      '"cron"."job_run_details"',
      [old],
      [old, { ...next, command: "different" }],
      context,
    ),
  );
  assert.throws(() =>
    assertOperationalDrift(
      '"cron"."job_run_details"',
      [old],
      [{ ...old, status: "changed" }],
      context,
    ),
  );
  const run = { id: "1", started_at: early, issued: "0", failures: "0" };
  assert.throws(() =>
    assertOperationalDrift(
      '"sports_feed"."weekly_core_job_runs"',
      [run],
      [run, { ...run, id: "2", started_at: late, issued: "4" }],
      context,
    ),
  );
  const mail = { singleton: "t", enabled: "f", last_tick_at: early };
  assertOperationalDrift(
    '"private"."docked_mail_scheduler"',
    [mail],
    [{ ...mail, last_tick_at: late }],
    context,
  );
  assert.throws(() =>
    assertOperationalDrift(
      '"private"."docked_mail_scheduler"',
      [mail],
      [{ ...mail, enabled: "t" }],
      context,
    ),
  );
});
