import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let pg: PGlite;
const email = "docked-preview-local-test@example.invalid";
const payload = {
  user: { id: "10000000-0000-4000-8000-000000000001", email },
  email_data: {
    email_action_type: "signup",
    site_url: "https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1",
    redirect_to: "http://localhost:3000/auth/callback",
    token_hash: "a".repeat(64),
    token: "synthetic-local-never-stored",
  },
};
before(async () => {
  pg = new PGlite();
  await pg.exec(
    "create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;",
  );
  const sql = await readFile(
    "docs/qa/hosted-preview/setup-auth-capture.sql",
    "utf8",
  );
  await assert.rejects(
    () => pg.exec(sql),
    /installation acknowledgement required/,
  );
  await pg.exec("rollback");
  assert.equal(
    (
      await pg.query<{ present: boolean }>(
        "select to_regnamespace('preview_auth') is not null present",
      )
    ).rows[0].present,
    false,
  );
  await pg.query("select set_config('docked.preview_project_ref',$1,false)", [
    "bckkllmndoxzpzdqrevb",
  ]);
  await pg.exec(sql);
});
after(async () => {
  await pg?.close();
});
async function capture(value: unknown = payload) {
  await pg.exec("set role supabase_auth_admin");
  try {
    return (
      await pg.query<{ result: Record<string, unknown> }>(
        "select preview_auth.capture_email($1::jsonb) result",
        [JSON.stringify(value)],
      )
    ).rows[0].result;
  } finally {
    await pg.exec("reset role");
  }
}
async function count() {
  return (
    await pg.query<{ n: number }>(
      "select count(*)::int n from preview_auth.captured_mail",
    )
  ).rows[0].n;
}
async function rollback(fn: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await fn();
  } finally {
    await pg.exec("rollback");
  }
}
test("capture is disabled by default and cannot be called through browser/service roles", async () => {
  assert.ok((await capture()).error);
  assert.equal(await count(), 0);
  for (const role of ["anon", "authenticated", "service_role"]) {
    await pg.exec(`set role ${role}`);
    await assert.rejects(
      () =>
        pg.query("select preview_auth.capture_email($1::jsonb)", [
          JSON.stringify(payload),
        ]),
      /permission denied/,
    );
    for (const table of [
      "configuration",
      "allowed_recipients",
      "allowed_redirects",
      "captured_mail",
    ])
      await assert.rejects(
        () => pg.exec(`select * from preview_auth.${table}`),
        /permission denied/,
      );
    await pg.exec("reset role");
  }
  const r = (
    await pg.query<{
      read: boolean;
      write: boolean;
      change: boolean;
      erase: boolean;
    }>(
      "select has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','SELECT') read,has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','INSERT') write,has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','UPDATE') change,has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','DELETE') erase",
    )
  ).rows[0];
  assert.deepEqual(r, {
    read: false,
    write: true,
    change: false,
    erase: false,
  });
});
test("only explicit active recipients capture; successful hook returns no credential data", async () => {
  await pg.exec(
    "update preview_auth.configuration set enabled=true,configured_at=clock_timestamp(),expires_at=clock_timestamp()+interval '2 hours'",
  );
  assert.ok((await capture()).error);
  await pg.query(
    "insert into preview_auth.allowed_recipients(email,expires_at) values($1,clock_timestamp()+interval '1 hour')",
    [email],
  );
  assert.deepEqual(await capture(), {});
  assert.deepEqual(await capture(), {});
  assert.equal(await count(), 1);
  const columns = (
    await pg.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='preview_auth' and table_name='captured_mail'",
    )
  ).rows.map((r) => r.column_name);
  assert.equal(columns.includes("token"), false);
  assert.equal(columns.includes("payload"), false);
  assert.equal(
    (
      await pg.query<{ bounded: boolean }>(
        "select bool_and(expires_at<=received_at+interval '30 minutes') bounded from preview_auth.captured_mail",
      )
    ).rows[0].bounded,
    true,
  );
  await pg.exec("set role supabase_auth_admin");
  await assert.rejects(
    () => pg.exec("select token_hash from preview_auth.captured_mail"),
    /permission denied/,
  );
  await assert.rejects(
    () => pg.exec("select preview_auth.purge_expired()"),
    /permission denied/,
  );
  await pg.exec("reset role");
});
test("unknown, revoked, expired and non-reserved addresses fail closed", async () => {
  for (const rejected of [
    "real@example.com",
    "other@example.invalid",
    "docked-preview-unlisted@example.invalid",
    "docked-preview-test@example.invalid.evil",
  ]) {
    assert.ok(
      (
        await capture({
          ...payload,
          user: { ...payload.user, email: rejected },
        })
      ).error,
    );
  }
  await rollback(async () => {
    await pg.query(
      "update preview_auth.allowed_recipients set revoked_at=clock_timestamp() where email=$1",
      [email],
    );
    assert.ok((await capture()).error);
  });
  await rollback(async () => {
    await pg.query(
      "update preview_auth.allowed_recipients set approved_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' where email=$1",
      [email],
    );
    assert.ok((await capture()).error);
  });
  await rollback(async () => {
    await pg.exec(
      "update preview_auth.configuration set configured_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour'",
    );
    assert.ok((await capture()).error);
  });
  assert.equal(await count(), 1);
});
test("redirect, site, action, email-change and payload bounds reject without storing anything", async () => {
  for (const delta of [
    { redirect_to: "https://example.invalid/auth/callback" },
    {
      redirect_to:
        "http://localhost:3000/auth/callback?next=https://example.invalid",
    },
    { site_url: "https://docked.com.au" },
    { site_url: "http://localhost:3000" },
    { site_url: "https://bckkllmndoxzpzdqrevb.supabase.co" },
    { site_url: "https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1/" },
    { site_url: "https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1?next=evil" },
    { site_url: "https://other-project.supabase.co/auth/v1" },
    { email_action_type: "invite" },
    { email_action_type: "email_change" },
    { token_hash: null },
  ])
    assert.ok(
      (
        await capture({
          ...payload,
          email_data: { ...payload.email_data, ...delta },
        })
      ).error,
    );
  assert.ok(
    (
      await capture({
        ...payload,
        user: { ...payload.user, new_email: "real@example.com" },
      })
    ).error,
  );
  assert.ok((await capture({ ...payload, oversize: "x".repeat(33000) })).error);
  assert.equal(await count(), 1);
});
test("capture RLS rejects direct out-of-allowlist inserts and owner purge erases expired/revoked credentials", async () => {
  await pg.exec("set role supabase_auth_admin");
  await assert.rejects(
    () =>
      pg.query(
        "insert into preview_auth.captured_mail(email,auth_user_id,action,token_hash,redirect_to,expires_at)values($1,$2,'signup',$3,$4,clock_timestamp()+interval '5 minutes')",
        [
          "docked-preview-unlisted@example.invalid",
          payload.user.id,
          "b".repeat(64),
          payload.email_data.redirect_to,
        ],
      ),
    /row-level security/,
  );
  await pg.exec("reset role");
  await rollback(async () => {
    await pg.exec(
      "update preview_auth.captured_mail set received_at=clock_timestamp()-interval '40 minutes',expires_at=clock_timestamp()-interval '15 minutes'",
    );
    assert.equal(
      (
        await pg.query<{ removed: number }>(
          "select preview_auth.purge_expired() removed",
        )
      ).rows[0].removed,
      1,
    );
    assert.equal(await count(), 0);
  });
  await pg.query(
    "update preview_auth.allowed_recipients set revoked_at=clock_timestamp() where email=$1",
    [email],
  );
  assert.equal(
    (
      await pg.query<{ removed: number }>(
        "select preview_auth.purge_expired() removed",
      )
    ).rows[0].removed,
    1,
  );
  assert.equal(await count(), 0);
});
test("all capture tables enable RLS, hook remains invoker and read-only preflight parses without Auth rows", async () => {
  assert.deepEqual(
    (
      await pg.query(
        "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='preview_auth' and relkind='r' and not relrowsecurity",
      )
    ).rows,
    [],
  );
  const functionRows = (
    await pg.query<{ prosecdef: boolean; proconfig: string[] }>(
      "select prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='preview_auth'",
    )
  ).rows;
  assert.equal(functionRows.length, 2);
  assert.equal(
    functionRows.every(
      (r) =>
        !r.prosecdef && r.proconfig.some((v) => v.startsWith("search_path=")),
    ),
    true,
  );
  // Local compatibility fixture: no accounts/sessions are inserted, and no hosted connection exists.
  await pg.exec(
    "create schema auth;create table auth.users(id uuid,email_confirmed_at timestamptz,is_anonymous boolean);create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;",
  );
  await pg.exec(await readFile("docs/qa/hosted-preview/preflight.sql", "utf8"));
  await pg.exec(await readFile("docs/qa/hosted-preview/assert-auth-capture.sql", "utf8"));
  assert.equal(
    (await pg.query<{ n: number }>("select count(*)::int n from auth.users"))
      .rows[0].n,
    0,
  );
});

test("GoTrue PKCE hashes retain the prefix and enforce the complete hexadecimal length bound", async () => {
  await rollback(async () => {
    await pg.query("insert into preview_auth.allowed_recipients(email,expires_at) values($1,clock_timestamp()+interval '1 hour')", [email]);
    for (const tokenHash of ["pkce_" + "a".repeat(40), "pkce_" + "b".repeat(256), "c".repeat(256)]) {
      assert.deepEqual(await capture({ ...payload, email_data: { ...payload.email_data, token_hash: tokenHash } }), {});
    }
    assert.equal(await count(), 3);
    for (const tokenHash of ["pkce_" + "a".repeat(39), "pkce_" + "a".repeat(257), "d".repeat(257), "pkce_" + "x".repeat(64), "other_" + "a".repeat(64)]) {
      assert.ok((await capture({ ...payload, email_data: { ...payload.email_data, token_hash: tokenHash } })).error);
    }
    assert.equal(await count(), 3);
  });
});

test("diagnostic upgrade emits only static field identifiers and preserves denied values privately", async () => {
  await pg.exec(await readFile("docs/qa/hosted-preview/upgrade-auth-capture-diagnostics.sql", "utf8"));
  const cases = [
    [{ ...payload, user: { ...payload.user, email: "private-value@real.example" } }, "recipient"],
    [{ ...payload, email_data: { ...payload.email_data, email_action_type: "private-value" } }, "action"],
    [{ ...payload, user: { ...payload.user, new_email: "private-value@real.example" } }, "email_change"],
    [{ ...payload, email_data: { ...payload.email_data, site_url: "https://private-value.example" } }, "site_url"],
    [{ ...payload, email_data: { ...payload.email_data, redirect_to: "https://private-value.example" } }, "redirect"],
    [{ ...payload, email_data: { ...payload.email_data, token_hash: "private-value" } }, "token_hash_format"],
    [{ ...payload, user: { ...payload.user, id: "private-value" } }, "user_id"],
  ] as const;
  for (const [value, field] of cases) {
    assert.deepEqual(await capture(value), { error: { http_code: 403, message: `Preview capture request denied: ${field}` } });
  }
  assert.equal(await count(), 0);
});
