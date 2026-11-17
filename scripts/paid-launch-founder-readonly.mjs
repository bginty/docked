/** Narrow read-only feasibility check for the proposed one-attempt session. */
import fs from "node:fs";
import assert from "node:assert/strict";
import postgres from "postgres";
const root =
  "C:/Users/61412/.codex/worktrees/batch1-pack-phone-20261116/Docked.com.au/private-data/";
let sql;
try {
  const cohort = JSON.parse(
    fs.readFileSync(root + "clean-transition-20261117/manifest.private.json"),
  );
  const owners = cohort.filter(
    (a) => a.kind === "owner" && a.originalRole === "owner",
  );
  assert.equal(owners.length, 1);
  const { databaseUrl } = JSON.parse(
    fs.readFileSync(
      root + "clean-retirement-execution-20261117/credentials.private.json",
    ),
  );
  const url = new URL(databaseUrl);
  assert(
    url.hostname.endsWith(".supabase.com") ||
      url.hostname.endsWith(".supabase.co"),
  );
  assert(
    decodeURIComponent(url.username).includes("pojoymtniryarxxunyvz") ||
      url.hostname.includes("pojoymtniryarxxunyvz"),
  );
  sql = postgres(databaseUrl, {
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
    },
    max: 1,
    prepare: false,
    connect_timeout: 15,
    onnotice: () => {},
  });
  const data = await sql.begin(async (tx) => {
    await tx`set transaction read only`;
    const [r] =
      await tx`select u.deleted_at is null active,u.email_confirmed_at is not null email_verified,u.phone_confirmed_at is not null phone_verified,coalesce(u.phone,'')<>'' phone_present,
 exists(select 1 from private.roles where user_id=u.id and role='owner') owner,
 exists(select 1 from auth.mfa_factors where user_id=u.id and status='verified' and factor_type='totp') mfa,
 exists(select 1 from launch_transition.accounts where user_id=u.id and kind='owner' and phase='retained') retained
 from auth.users u where u.id=${owners[0].id}::uuid`;
    assert(r && r.active && r.email_verified && r.owner && r.mfa && r.retained);
    return r;
  });
  const report = {
    at: new Date().toISOString(),
    productionWrites: 0,
    smsSent: 0,
    originalFounderMatched: true,
    canUseExistingUnverifiedPhoneRoute: !data.phone_verified,
    state: data,
  };
  fs.writeFileSync(
    "docs/qa/paid-launch-final-20261118/founder-phone-readonly.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch {
  console.error(
    "Narrow read-only Founder feasibility check failed; no identity or credential emitted.",
  );
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 5 });
}
