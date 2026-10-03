// OPERATOR ONLY. Never import into application code. No email or signup endpoint is used.
// --plan is read-only; provisioning requires both an explicit mode and exact-project confirmation.
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { db } from "../../src/server/db";
import { previewDatabaseBound } from "../../src/core/preview-auth";

const ref = "bckkllmndoxzpzdqrevb";
const org = "ernfnkcbalhyqpsrzdwa";
const modes = ["--plan", "--provision-durable", "--provision-acceptance"];
type Entry = { id?: string; email: string; password: string };
async function absent(path: string) {
  try {
    await access(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw Error("PRIVATE_OUTPUT_UNREADABLE");
  }
  throw Error("PRIVATE_OUTPUT_EXISTS_REVIEW_BEFORE_RETRY");
}
async function main() {
  let sql: ReturnType<typeof db> | undefined;
  let committed = false;
  const output = resolve("private-data/android-preview");
  try {
    const mode = process.argv[2];
    if (
      !modes.includes(mode) ||
      (mode === "--plan"
        ? process.argv.length !== 3
        : process.argv.length !== 4 ||
          process.argv[3] !== `--confirm-project=${ref}`)
    )
      throw Error("EXPLICIT_PREVIEW_MODE_REQUIRED");
    const connection = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    if (
      connection.projectRef !== ref ||
      connection.organizationId !== org ||
      connection.supabaseUrl !== `https://${ref}.supabase.co` ||
      process.env.DATABASE_URL !== connection.databaseUrl ||
      process.env.APP_ENV !== "preview" ||
      process.env.SUPABASE_ENV !== "preview" ||
      !previewDatabaseBound(process.env) ||
      typeof connection.secretKey !== "string" ||
      !connection.secretKey.startsWith("sb_secret_")
    )
      throw Error("EXACT_PREVIEW_IDENTITY_REQUIRED");
    sql = db();
    const closed = (
      await sql`select
      (select count(*)::int from supabase_migrations.schema_migrations) migrations,
      (select max(version) from supabase_migrations.schema_migrations) latest,
      (select count(*)::int from private.feature_flags where enabled) enabled_flags,
      (select count(*)::int from private.region_policies where approved and not preview_community_only) ordinary_approvals,
      (select count(*)::int from preview_auth.configuration where enabled) capture_enabled,
      (select count(*)::int from private.tip_publications) tips,
      (select count(*)::int from private.community_edges) edges,
      (select count(*)::int from private.market_references) references`
    )[0];
    if (
      closed.migrations !== 9 ||
      closed.latest !== "20261003062615" ||
      [
        closed.enabled_flags,
        closed.ordinary_approvals,
        closed.capture_enabled,
        closed.tips,
        closed.edges,
        closed.references,
      ].some((v) => v !== 0)
    )
      throw Error("CLOSED_PREVIEW_BASELINE_REQUIRED");
    if (mode === "--plan") {
      console.log(
        "Verified Docked Preview provisioning plan: optional one durable tester with untouched age/terms onboarding; or two disposable QA accounts with explicit QA-only attestations. Reserved example.invalid identities; seven-day social/profile UUID grants; no staff roles, email, sporting data or feature activation. No changes made.",
      );
      return;
    }
    const qa = mode === "--provision-acceptance";
    const entries: Entry[] = (qa ? ["qa-a", "qa-b"] : ["tester"]).map(
      (alias) => ({
        email: `docked-preview-s24-${alias}-20261003@example.invalid`,
        password: randomBytes(27).toString("base64url") + "Aa1!",
      }),
    );
    const journal = resolve(
      output,
      qa ? "provision-acceptance-state.json" : "provision-durable-state.json",
    );
    const credentials = resolve(
      output,
      qa ? "acceptance.json" : "tester-credentials.txt",
    );
    await mkdir(output, { recursive: true });
    await absent(journal);
    await absent(credentials);
    const admin = createClient(connection.supabaseUrl, connection.secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const existing = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (
      existing.error ||
      existing.data.users.some((u) =>
        entries.some((e) => e.email === u.email),
      ) ||
      existing.data.users.length >= 1000
    )
      throw Error("ROSTER_ALREADY_EXISTS_OR_NOT_VERIFIABLE");
    const runId = randomUUID();
    const saveState = (state: string, exclusive = false) =>
      writeFile(
        journal,
        JSON.stringify(
          { projectRef: ref, mode, runId, state, qaFixture: qa, entries },
          null,
          2,
        ) + "\n",
        { mode: 0o600, flag: exclusive ? "wx" : "w" },
      );
    await saveState("prepared-not-created", true);
    for (const entry of entries) {
      const created = await admin.auth.admin.createUser({
        email: entry.email,
        password: entry.password,
        email_confirm: true,
        app_metadata: {
          preview_operator_provisioned: true,
          email_ownership_verified: false,
          qa_fixture: qa,
        },
        user_metadata: {
          preview_label: qa
            ? "Disposable QA account; synthetic test attestations"
            : "Operator-provisioned preview tester; onboarding required",
        },
      });
      if (
        created.error ||
        !created.data.user ||
        created.data.user.email !== entry.email ||
        !/^[0-9a-f-]{36}$/.test(created.data.user.id)
      )
        throw Error("AUTH_PROVISION_FAILED_REVIEW_PRIVATE_JOURNAL");
      entry.id = created.data.user.id;
      await saveState("auth-created-application-pending");
    }
    const provisioned = await sql.begin(async (tx) => {
      const policy = (
        await tx`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,evidence,preview_community_only)
        values('XX','DOCKED_PREVIEW',${`android-preview-${runId}`},clock_timestamp(),clock_timestamp()+interval '7 days',clock_timestamp()+interval '7 days',true,18,array['community_social','public_profiles'],'{}',
        'PREVIEW TEST ONLY: named UUID testing access, not legal approval, marketing authority, sporting data or public launch.',true) returning id,effective_to`
      )[0];
      for (const entry of entries) {
        if (!entry.id) throw Error("AUTH_ID_MISSING");
        await tx`insert into public.profiles(id,country,state,age_attested,accepted_version,onboarding_completed_at)
          values(${entry.id},${qa ? "XX" : ""},${qa ? "PREVIEW_QA" : ""},${qa},${qa ? "preview-qa-fixture-2026-10-03" : ""},${qa ? new Date() : null})`;
        await tx`insert into public.notification_preferences(user_id,paused,digest,edge_alerts,education,quiet_start,quiet_end)
          values(${entry.id},${!qa},'off',false,false,21,${qa ? 21 : 8})`;
        if (qa)
          await tx`insert into private.consent_events(user_id,purpose,granted,version,actor)
          values(${entry.id},'qa_fixture_age_and_terms',true,'preview-qa-fixture-2026-10-03','preview-qa-operator-synthetic-test')`;
        await tx`insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,granted_by,reason)
          values(${entry.id},${policy.id},${ref},${policy.effective_to},'preview-operator',${qa ? "Disposable HTTPS QA fixture, no real-world consent or performance claims" : "User-requested S24 preview tester; age and terms onboarding left to the user"})`;
        if (
          (await tx`select 1 from private.roles where user_id=${entry.id}`)
            .length
        )
          throw Error("PRIVILEGED_ROLE_FORBIDDEN");
      }
      return {
        policyId: String(policy.id),
        expiresAt: (policy.effective_to as Date).toISOString(),
      };
    });
    committed = true;
    await saveState("application-provisioned");
    if (qa)
      await writeFile(
        credentials,
        JSON.stringify(
          {
            projectRef: ref,
            qaFixture: true,
            memberA: entries[0],
            memberB: { ...entries[1], disposable: true },
            ...provisioned,
          },
          null,
          2,
        ) + "\n",
        { mode: 0o600, flag: "wx" },
      );
    else
      await writeFile(
        credentials,
        [
          "Docked Preview — operator-provisioned tester",
          "Project: " + ref,
          "This reserved account was confirmed by the operator; no email was sent and email ownership was not verified.",
          "Complete age attestation, country/state, terms and preferences in the app before community access.",
          "Access expires: " + provisioned.expiresAt,
          "Email: " + entries[0].email,
          "Password: " + entries[0].password,
          "No staff privileges, paid access, sporting data or validated strategy claims.",
        ].join("\n") + "\n",
        { mode: 0o600, flag: "wx" },
      );
    console.log(
      qa
        ? "Two reserved disposable QA accounts provisioned; credentials saved privately in acceptance.json. No email sent."
        : "Reserved durable tester provisioned; credentials saved privately in tester-credentials.txt. Ordinary onboarding remains required. No email sent.",
    );
  } catch {
    // Partial Auth creation must be reconciled against the private journal, never
    // retried blindly or claimed successful. It cannot bypass absent/rolled-back app grants.
    console.error(
      committed
        ? "Provisioning committed but credential output requires private-journal recovery. Do not rerun blindly."
        : "Provisioning did not complete; inspect private provisioning journal before retrying. No credentials printed.",
    );
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}
void main();
