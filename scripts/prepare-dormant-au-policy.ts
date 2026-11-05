/** Owner-approved eligibility/published-policy binding, not public activation.
 * Plan by default; explicit apply additionally requires the isolated rehearsal. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const mode = process.argv[2] ?? "--plan";
assert(["--plan", "--apply-owner-authorised-dormant"].includes(mode));
const root = process.cwd(),
  dir = "private-data/public-configuration-20261105",
  out = "docs/qa/public-configuration-20261105";
mkdirSync(dir, { recursive: true });
mkdirSync(out, { recursive: true });
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const version = "docked-au-adult-closed-loop-v1",
  consent = "2026-11-02-release-preparation-v2";
const authority =
  "Owner expressly approved prospective v2 Terms/Privacy binding and AU adult eligibility for ACT/NSW/NT/QLD/SA/TAS/VIC/WA on 6 November 2026 Sydney, with commercial marketplace transfers, swaps, paid entry, withdrawals and prizes OFF. Scope basis: owner decisions plus FINAL_MARKETPLACE_COMMERCIAL_ASSESSMENT_20261105.txt; no independent legal/regulatory approval is asserted. Public programme and registration remain disabled.";
async function main() {
  if (mode === "--plan") {
    const at = new Date(),
      to = new Date(at.getTime() + 90 * 86400000),
      review = new Date(at.getTime() + 30 * 86400000);
    const model = existsSync(dir + "/au-policy.private.json")
      ? JSON.parse(readFileSync(dir + "/au-policy.private.json", "utf8"))
      : {
          version,
          consent,
          authority,
          effective_from: at.toISOString(),
          effective_to: to.toISOString(),
          review_at: review.toISOString(),
          states: ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"],
        };
    assert.equal(model.version, version);
    assert.equal(model.consent, consent);
    assert.equal(model.authority, authority);
    assert.deepEqual(model.states, [
      "ACT",
      "NSW",
      "NT",
      "QLD",
      "SA",
      "TAS",
      "VIC",
      "WA",
    ]);
    assert(
      Date.parse(model.review_at) > Date.now(),
      "Expired plans need a separately reviewed policy version; do not silently renew",
    );
    const program = `do $au_policy$ declare m jsonb:=${literal(JSON.stringify(model))}::jsonb; s text; existing private.region_policies; before_profiles text; before_roster text; begin
perform pg_advisory_xact_lock(202611020347::bigint);
if exists(select 1 from public_gameplay.policy where enabled) or exists(select 1 from public_gameplay.sports where visible or play_enabled) or exists(select 1 from public_gameplay.rounds where enabled) or exists(select 1 from private.feature_flags where key='registration' and enabled) or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) then raise exception 'Public/financial activation must remain disabled';end if;
if (m->>'review_at')::timestamptz<=clock_timestamp() then raise exception 'Fresh owner-approved policy review window required';end if;
select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'')) into before_profiles from public.profiles p;
select md5(coalesce(jsonb_agg(to_jsonb(r) order by sport)::text,'')) into before_roster from sports_feed.free_core_programmes r;
for s in select jsonb_array_elements_text(m->'states') loop
 select * into existing from private.region_policies where country='AU' and state=s and version=m->>'version';
 if found then
  if not existing.approved or existing.minimum_age<>18 or existing.preview_community_only or existing.effective_from<>(m->>'effective_from')::timestamptz or existing.effective_to<>(m->>'effective_to')::timestamptz or existing.review_at<>(m->>'review_at')::timestamptz or existing.evidence<>m->>'authority' then raise exception 'Existing AU eligibility differs; do not overwrite';end if;
 else
  if exists(select 1 from private.region_policies where country='AU' and state=s) then raise exception 'Review existing regional policy before adding';end if;
  insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,notices,evidence,communication_rules,preview_community_only) values('AU',s,m->>'version',(m->>'effective_from')::timestamptz,(m->>'effective_to')::timestamptz,(m->>'review_at')::timestamptz,true,18,array['community_social','public_profiles'],'{}','{}',m->>'authority','{}',false);
 end if;
end loop;
update public_gameplay.policy set terms_version=m->>'consent',privacy_version=m->>'consent',valid_until=(m->>'effective_to')::timestamptz,authority=m->>'authority' where id and not enabled;
if before_profiles is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'')) from public.profiles p) or before_roster is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(r) order by sport)::text,'')) from sports_feed.free_core_programmes r) then raise exception 'Account/programme records changed';end if;
if (select count(*) from private.region_policies where country='AU' and version=m->>'version')<>8 or exists(select 1 from public_gameplay.policy where enabled) then raise exception 'Eight scoped eligibility rows and dormant programme required';end if;
end $au_policy$;`;
    writeFileSync(dir + "/au-policy.sql", program, { mode: 0o600 });
    writeFileSync(dir + "/au-policy.private.json", JSON.stringify(model), {
      mode: 0o600,
    });
    const report = {
      at: at.toISOString(),
      mode,
      sqlSha256: hash(program),
      ...model,
      regionalApproval: true,
      minimumAge: 18,
      previewCommunityOnly: false,
      features: ["community_social", "public_profiles"],
      publicProgrammeEnabled: false,
      publicRegistrationEnabled: false,
      commercialPaymentsEnabled: false,
      marketplaceTransfersEnabled: false,
      noBetaConsentCopy: true,
      productionWrites: 0,
    };
    writeFileSync(
      out + "/au-policy-plan.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    return;
  }
  const program = readFileSync(dir + "/au-policy.sql", "utf8"),
    plan = JSON.parse(readFileSync(out + "/au-policy-plan.json", "utf8")),
    test = JSON.parse(readFileSync(out + "/au-policy-rehearsal.json", "utf8")),
    restored = JSON.parse(
      readFileSync(out + "/restore/restore-drill.json", "utf8"),
    );
  assert.equal(hash(program), plan.sqlSha256);
  assert.equal(test.sqlSha256, plan.sqlSha256);
  assert.equal(test.passed, true);
  assert.equal(restored.restored, true);
  assert.equal(restored.protectedRecordsUnchanged, true);
  const archive = JSON.parse(
    readFileSync(out + "/restore/archive-integrity.json", "utf8"),
  );
  assert.equal(archive.authenticated, true);
  assert.equal(archive.sha256Matches, true);
  assert.equal(archive.bytes, restored.archiveBytes);
  assert(Date.parse(restored.backupAt) > Date.now() - 2 * 3600000);
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const result = await sql.begin(
      "isolation level repeatable read",
      async (t) => {
        await t`set local lock_timeout='5s'`;
        await t`set local statement_timeout='90s'`;
        await t.unsafe(program);
        const regions =
          await t`select country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,preview_community_only from private.region_policies where country='AU' and version=${version} order by state`;
        const [policy] = await t`select * from public_gameplay.policy where id`;
        return { regions, policy };
      },
    );
    const report = {
      at: new Date().toISOString(),
      sqlSha256: plan.sqlSha256,
      ...result,
      publicProgrammeEnabled: false,
      registrationChanged: false,
      paymentsChanged: false,
      profilesChanged: false,
      consentsChanged: false,
      legacyEligibilityChanged: false,
      migrations: [],
      passed: true,
    };
    writeFileSync(
      out + "/au-policy-applied.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Dormant AU preparation failed",
  );
  process.exitCode = 1;
});
