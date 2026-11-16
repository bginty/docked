/** Read-only preservation evidence; never emits phone numbers or Auth tokens. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
const mode = process.argv[2];
assert(/^(before|after|observed-[a-z0-9-]+)$/.test(mode));
const ref = "bckkllmndoxzpzdqrevb";
const folder = "docs/qa/phone-acceptance-20261117/continuation";
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const connection = read(
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
);
assert.equal(connection.projectRef, ref);
assert.equal(
  decodeURIComponent(new URL(connection.databaseUrl).username),
  "postgres." + ref,
);
const identities = read(
  "private-data/final-commercial-20261116/phone-test/identities.prepared.private.json",
);
assert.equal(identities.projectRef, ref);
const sql = postgres(connection.databaseUrl, {
  max: 1,
  connect_timeout: 10,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
try {
  const report = await sql.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      await tx`set local statement_timeout='30s'`;
      const tables =
        await tx`select schemaname,tablename from pg_tables where schemaname in ('commercial_billing','beta_fantasy') or (schemaname='public' and tablename='profiles') or (schemaname='private' and tablename='roles') order by schemaname,tablename`;
      const assets = [];
      for (const table of tables) {
        const [state] =
          await tx`select count(*)::int rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) digest from ${tx(table.schemaname + "." + table.tablename)} t`;
        assets.push({
          table: table.schemaname + "." + table.tablename,
          ...state,
        });
      }
      const members = [];
      for (const a of identities.accounts) {
        const [u] =
          await tx`select email_confirmed_at is not null email_verified,deleted_at is null and (banned_until is null or banned_until<=now()) active,phone_confirmed_at is not null phone_verified,phone_change_sent_at,phone_confirmed_at,(select count(*)::int from private.roles where user_id=auth.users.id) roles,(select coalesce(sum(remaining),0)::int from commercial_billing.lots where member_id=auth.users.id) balance,(select coalesce(sum(exposure_credits),0)::int from commercial_billing.recovery_cases where member_id=auth.users.id and state='OPEN') hold from auth.users where id=${a.userId}`;
        assert(u?.email_verified && u.active && u.roles === 0);
        members.push({ identitySha256: hash(a.userId), ...u });
      }
      const [control] =
        await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`;
      assert(
        !control.sales_enabled &&
          !control.issuance_enabled &&
          !control.transfers_enabled &&
          !control.gameplay_enabled,
      );
      assert.equal(
        members.reduce((n, m) => n + m.hold, 0),
        5700,
      );
      const [claims] =
        await tx`select count(*)::int count from private.verified_phone_claims`;
      const [guard] =
        await tx`select exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='docked_verified_phone_claim' and tgenabled='O' and tgfoid=to_regprocedure('private.sync_verified_phone_claim()')) canonical_trigger`;
      assert(guard.canonical_trigger);
      return {
        at: new Date().toISOString(),
        projectRef: ref,
        mode,
        assets,
        members,
        control,
        claims: claims.count,
        canonicalTrigger: true,
        productionAccess: false,
        databaseWrites: 0,
        phonesOrCredentialsEmitted: false,
      };
    },
  );
  if (mode === "before") assert(report.members.every((m) => !m.phone_verified));
  else {
    const before = read(folder + "/census-before.json");
    report.previousAssetsUnchanged =
      JSON.stringify(report.assets) === JSON.stringify(before.assets);
    assert(report.previousAssetsUnchanged, "Protected Preview assets changed");
  }
  fs.writeFileSync(
    folder + "/census-" + mode + ".json",
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      mode,
      protectedTables: report.assets.length,
      members: report.members,
      canonicalClaims: report.claims,
      assetsPreserved: report.previousAssetsUnchanged ?? "baseline",
      productionAccess: false,
    }),
  );
} catch {
  console.error(
    "Preview read-only census failed; no changes or private values emitted.",
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
