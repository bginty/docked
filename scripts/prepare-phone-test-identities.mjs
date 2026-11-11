/** Read-only exact Preview fixture selection. Writes an ignored, inactive local
 * allowlist only; never signs in, creates users, changes credentials or enables SMS. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const ref = "bckkllmndoxzpzdqrevb";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const fixturePaths = [
  "C:/Users/61412/.codex/worktrees/dual-store-readiness/Docked.com.au/private-data/restored-public-preview/fixture.private.json",
  "C:/Users/61412/.codex/worktrees/billing-ack-preview-20261105/Docked.com.au/private-data/restored-public-preview/fixture.private.json",
  "C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/restored-public-preview/fixture.private.json",
];
const privateDir = "private-data/v31-phone-test";
const privateFile = `${privateDir}/identities.prepared.private.json`;
const reportFile = "docs/qa/v31-phone-ops-20261111/fixture-selection.json";
let sql;
let stage = "local-fixture-provenance";
try {
  assert.equal(
    execFileSync("git", ["check-ignore", privateFile], {
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
    privateFile,
  );
  const fixtures = new Map();
  for (const fixturePath of fixturePaths) {
    if (!fs.existsSync(fixturePath)) continue;
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    assert.equal(fixture.projectRef, ref);
    assert.equal(fixture.origin, origin);
    for (const account of fixture.accounts) {
      if (!/^(member|promotion)$/.test(account.kind)) continue;
      assert.match(
        account.email,
        /^docked-preview-public-member-[a-f0-9]{10}@example\.invalid$/,
      );
      assert(
        typeof account.password === "string" && account.password.length >= 24,
      );
      if (!fixtures.has(account.email))
        fixtures.set(account.email, { fixturePath, kind: account.kind });
    }
  }
  assert.equal(
    fixtures.size,
    2,
    "Exactly two original synthetic fixture records required",
  );
  const connection = JSON.parse(
    fs.readFileSync(
      "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
      "utf8",
    ),
  );
  assert.equal(connection.projectRef, ref);
  const url = new URL(connection.databaseUrl);
  assert.equal(decodeURIComponent(url.username), `postgres.${ref}`);
  assert.equal(url.port, "5432");
  assert.equal(url.pathname, "/postgres");
  sql = postgres(connection.databaseUrl, {
    max: 1,
    connect_timeout: 10,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
    },
    onnotice: () => {},
  });
  const selected = await sql.begin("read only", async (tx) => {
    const result = [];
    for (const [email, fixture] of fixtures) {
      stage = "authoritative-read-only-query";
      const rows = await tx`select u.id,
        u.email_confirmed_at is not null email_verified,
        u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) and not coalesce(u.is_anonymous,false) active,
        u.phone is null or u.phone='' no_phone,
        u.phone_confirmed_at is null phone_unverified,
        exists(select 1 from preview_auth.allowed_recipients a where a.email=u.email and a.approved_at<=u.created_at and a.expires_at>=u.created_at) original_capture_admission,
        not exists(select 1 from preview_auth.allowed_recipients a where a.email=u.email and a.revoked_at is null and a.expires_at>clock_timestamp()) capture_window_closed,
        (select count(*)::int from private.roles r where r.user_id=u.id) roles,
        (select count(*)::int from auth.mfa_factors f where f.user_id=u.id and f.status='verified') verified_mfa_factors,
        not exists(select 1 from public.profiles p where p.id=u.id and p.disabled_at is not null) profile_not_disabled,
        (select count(*)::int from commercial_billing.receipts r where r.member_id=u.id) commercial_receipts,
        (select count(*)::int from commercial_billing.receipts r where r.member_id=u.id and (r.environment<>'acceptance' or r.state<>'REVOKED' or r.refunded_cents<>r.gross_cents)) nonclosed_or_nonacceptance_receipts,
        (select count(*)::int from commercial_billing.lots l where l.member_id=u.id) commercial_lots,
        (select coalesce(sum(l.remaining),0)::int from commercial_billing.lots l where l.member_id=u.id) remaining_credits,
        (select count(*)::int from commercial_billing.cards c where c.owner_id=u.id) commercial_cards,
        (select count(*)::int from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition where c.owner_id=u.id and (d.rights_reference is distinct from 'isolated-v30-synthetic-fixture' or d.snapshot->>'synthetic' is distinct from 'true' or d.snapshot->>'testInventory' is distinct from 'true')) nonfixture_cards,
        (select count(*)::int from beta_fantasy.cards c where c.owner_id=u.id) historical_cards
        from auth.users u where u.email=${email}`;
      stage = "unique-existing-identity";
      assert.equal(
        rows.length,
        1,
        "Original fixture must match one existing Auth identity",
      );
      const row = rows[0];
      for (const key of [
        "email_verified",
        "active",
        "no_phone",
        "phone_unverified",
        "original_capture_admission",
        "capture_window_closed",
        "profile_not_disabled",
      ]) {
        stage = key;
        assert.equal(row[key], true, `Fixture precondition: ${key}`);
      }
      for (const key of [
        "roles",
        "verified_mfa_factors",
        "nonclosed_or_nonacceptance_receipts",
        "remaining_credits",
        "nonfixture_cards",
        "historical_cards",
      ]) {
        stage = key;
        assert.equal(
          row[key],
          0,
          `Fixture must be ordinary with no genuine or spendable assets: ${key}`,
        );
      }
      result.push({ id: row.id, fixture, checks: row });
    }
    return result;
  });
  assert.equal(new Set(selected.map((row) => row.id)).size, 2);
  const now = new Date().toISOString();
  const privateArtifact = {
    preparedAt: now,
    projectRef: ref,
    origin,
    enabled: false,
    testWindowUntil: null,
    DOCKED_ISOLATED_PHONE_MEMBERS: selected.map((row) => row.id).join(","),
    accounts: selected.map((row, i) => ({
      label: `fixture-${i + 1}`,
      userId: row.id,
      originalFixturePath: row.fixture.fixturePath,
      originalFixtureKind: row.fixture.kind,
    })),
    note: "Prepared only. Revalidate before separately authorised Preview testing. Credentials remain in the original ignored fixture files; do not copy them into reports. No login or provider activation performed.",
  };
  const privateText = JSON.stringify(privateArtifact, null, 2);
  fs.mkdirSync(privateDir, { recursive: true });
  fs.writeFileSync(privateFile, privateText, { mode: 0o600 });
  const report = {
    observedAt: now,
    projectRef: ref,
    mode: "read-only-existing-fixture-selection",
    source:
      "Original ignored fixture records cross-checked with current Auth identity and server-controlled historical capture admission",
    selectedCount: selected.length,
    selectedChecks: selected.map((row, i) => {
      const checks = Object.fromEntries(
        Object.entries(row.checks).filter(([key]) => key !== "id"),
      );
      return {
        label: `fixture-${i + 1}`,
        originalFixtureKind: row.fixture.kind,
        ...checks,
      };
    }),
    privateArtifact: privateFile,
    privateArtifactSha256: createHash("sha256")
      .update(privateText)
      .digest("hex"),
    credentialsAvailableInOriginalFiles: true,
    credentialsTestedThisRun: false,
    credentialsCopiedOrEmitted: false,
    priorSyntheticAcceptanceAssetsPreserved: true,
    identitiesEmittedInPublicReport: false,
    testWindowActivated: false,
    productionAccess: false,
    databaseWrites: 0,
    authWrites: 0,
    smsAttempts: 0,
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch {
  console.error(
    `Existing Preview fixture selection did not verify at ${stage}; no private diagnostic emitted.`,
  );
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
