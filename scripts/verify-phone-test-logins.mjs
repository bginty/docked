/** Authorised existing synthetic Preview Auth acceptance only. No browser, signup,
 * recovery, password change, email or SMS. Explicit flag required. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const ref = "bckkllmndoxzpzdqrevb";
const authOrigin = `https://${ref}.supabase.co`;
const report = {
  observedAt: new Date().toISOString(),
  projectRef: ref,
  scope: "existing-synthetic-preview-email-password-auth-only",
  accounts: [],
  productionAccess: false,
  signupAttempts: 0,
  passwordChanges: 0,
  recoveryAttempts: 0,
  smsAttempts: 0,
  emailAttempts: 0,
  applicationOrWebViewAcceptance: false,
  credentialsOrTokensEmitted: false,
  passed: false,
};
let sql;
let stage = "explicit-mode-and-private-provenance";
try {
  assert.deepEqual(process.argv.slice(2), ["--verify-preview-logins"]);
  const prepared = JSON.parse(
    fs.readFileSync(
      "private-data/v31-phone-test/identities.prepared.private.json",
      "utf8",
    ),
  );
  assert.equal(prepared.projectRef, ref);
  assert.equal(prepared.enabled, false);
  assert.equal(prepared.testWindowUntil, null);
  assert.equal(prepared.accounts.length, 2);
  const connection = JSON.parse(
    fs.readFileSync(
      "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
      "utf8",
    ),
  );
  assert.equal(connection.projectRef, ref);
  const dbUrl = new URL(connection.databaseUrl);
  assert.equal(decodeURIComponent(dbUrl.username), `postgres.${ref}`);
  assert.equal(dbUrl.port, "5432");
  assert.equal(dbUrl.pathname, "/postgres");
  assert(connection.publishableKey.startsWith("sb_publishable_"));
  sql = postgres(connection.databaseUrl, {
    max: 1,
    connect_timeout: 10,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
    },
    onnotice: () => {},
  });
  const fingerprint = (id) =>
    sql.begin(
      "read only",
      async (tx) =>
        (
          await tx`select
    (select md5(coalesce(string_agg(md5(row_to_json(r)::text),'|' order by r.key),'')) from commercial_billing.receipts r where r.member_id=${id}) receipts,
    (select md5(coalesce(string_agg(md5(row_to_json(l)::text),'|' order by l.id),'')) from commercial_billing.lots l where l.member_id=${id}) lots,
    (select md5(coalesce(string_agg(md5(row_to_json(c)::text),'|' order by c.id),'')) from commercial_billing.cards c where c.owner_id=${id}) commercial_cards,
    (select md5(coalesce(string_agg(md5(row_to_json(c)::text),'|' order by c.id),'')) from beta_fantasy.cards c where c.owner_id=${id}) historical_cards`
        )[0],
    );
  for (const selected of prepared.accounts) {
    const outcome = {
      label: selected.label,
      authenticated: false,
      freshUserConfirmed: false,
      signoutAccepted: false,
      createdSessionAbsent: false,
      assetsUnchanged: false,
    };
    report.accounts.push(outcome);
    const fixture = JSON.parse(
      fs.readFileSync(selected.originalFixturePath, "utf8"),
    );
    assert.equal(fixture.projectRef, ref);
    const account = fixture.accounts.find(
      (a) => a.kind === selected.originalFixtureKind,
    );
    assert.match(
      account.email,
      /^docked-preview-public-member-[a-f0-9]{10}@example\.invalid$/,
    );
    assert(
      typeof account.password === "string" && account.password.length >= 24,
    );
    const [identity] = await sql.begin(
      "read only",
      (tx) =>
        tx`select id,email_confirmed_at is not null verified,deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) active,not exists(select 1 from private.roles r where r.user_id=u.id) ordinary from auth.users u where id=${selected.userId} and email=${account.email}`,
    );
    assert(identity?.verified && identity.active && identity.ordinary);
    const before = await fingerprint(selected.userId);
    const client = createClient(authOrigin, connection.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => {
          const requested = new URL(
            typeof input === "string" ? input : (input.url ?? input.href),
          );
          assert.equal(requested.origin, authOrigin);
          assert(requested.pathname.startsWith("/auth/v1/"));
          return fetch(input, { ...init, redirect: "error" });
        },
      },
    });
    let sessionId;
    let sessionCreated = false;
    try {
      stage = `${selected.label}-email-password-login`;
      const result = await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      assert.equal(result.error, null);
      assert(result.data.session?.access_token);
      sessionCreated = true;
      assert.equal(result.data.user?.id, selected.userId);
      const claims = JSON.parse(
        Buffer.from(
          result.data.session.access_token.split(".")[1],
          "base64url",
        ).toString("utf8"),
      );
      sessionId = claims.session_id;
      assert.match(sessionId, /^[a-f0-9-]{36}$/);
      outcome.authenticated = true;
      stage = `${selected.label}-fresh-authoritative-user`;
      const fresh = await client.auth.getUser();
      assert.equal(fresh.error, null);
      assert.equal(fresh.data.user?.id, selected.userId);
      assert(fresh.data.user.email_confirmed_at);
      assert(!fresh.data.user.phone_confirmed_at);
      outcome.freshUserConfirmed = true;
    } finally {
      if (sessionCreated) {
        stage = `${selected.label}-close-created-session`;
        const signedOut = await client.auth.signOut({ scope: "local" });
        outcome.signoutAccepted = signedOut.error === null;
        assert(outcome.signoutAccepted);
        if (sessionId) {
          const [sessions] = await sql.begin(
            "read only",
            (tx) =>
              tx`select count(*)::int n from auth.sessions where id=${sessionId} and user_id=${selected.userId}`,
          );
          outcome.createdSessionAbsent = sessions.n === 0;
          assert(outcome.createdSessionAbsent);
        }
      }
      const after = await fingerprint(selected.userId);
      outcome.assetsUnchanged =
        JSON.stringify(before) === JSON.stringify(after);
      assert(outcome.assetsUnchanged);
    }
  }
  report.passed =
    report.accounts.length === 2 &&
    report.accounts.every(
      (row) =>
        row.authenticated &&
        row.freshUserConfirmed &&
        row.signoutAccepted &&
        row.createdSessionAbsent &&
        row.assetsUnchanged,
    );
  assert(report.passed);
} catch {
  report.failureStage = stage;
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(
    "docs/qa/v31-phone-ops-20261111/fixture-hosted-auth.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
