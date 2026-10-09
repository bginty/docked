// Operator-only. Do not import into application code.
// One fresh disposable QA identity; never the owner's tester or any previous QA roster.
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { db } from "../../src/server/db";
import { processAccountDeletion } from "../../src/server/account-deletion";
import { previewDatabaseBound } from "../../src/core/preview-auth";
import { assertHostedPreview } from "../../src/core/hosted-preview";

const project = "bckkllmndoxzpzdqrevb";
const organization = "ernfnkcbalhyqpsrzdwa";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const ownerEmail = "docked-preview-s24-tester-20261003@example.invalid";
const ownerCredentialPath =
  "private-data/android-preview/tester-credentials.txt";
const output = "private-data/mobile-app-ux";
const journalPath = `${output}/provision-state.json`;
const fixturePath = `${output}/acceptance.json`;
const evidence = "docs/qa/mobile-app-ux/operator";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
type Sql = ReturnType<typeof db>;
type Journal = {
  projectRef: string;
  organizationId: string;
  runId: string;
  qaFixture: true;
  disposable: true;
  state: "prepared" | "auth-created" | "ready" | "erased";
  createdAt: string;
  email: string;
  password: string;
  id?: string;
  socialProfileId?: string;
  policyId?: string;
  expiresAt?: string;
  ownerHash: string;
  ownerCredentialHash: string;
};
const expectedEmail = (runId: string) =>
  `docked-preview-mobile-ux-${runId}@example.invalid`;

async function absent(file: string) {
  try {
    await access(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw Error("Private output unreadable");
  }
  throw Error(
    "Existing run must be reviewed; never overwrite a journal or credential file",
  );
}
async function save(journal: Journal, exclusive = false) {
  await writeFile(journalPath, JSON.stringify(journal, null, 2) + "\n", {
    mode: 0o600,
    flag: exclusive ? "wx" : "w",
  });
}
async function receipt(name: string, value: Record<string, unknown>) {
  await mkdir(evidence, { recursive: true });
  await writeFile(
    `${evidence}/${name}.json`,
    JSON.stringify(
      { projectRef: project, recordedAt: new Date().toISOString(), ...value },
      null,
      2,
    ) + "\n",
  );
}

/** Existing helper verifies project name + organization using a scoped Management API GET. */
function inspectProject() {
  const safe = JSON.parse(
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        resolve("scripts/hosted-preview/auth-management.ps1"),
        "-Mode",
        "--inspect",
      ],
      {
        encoding: "utf8",
        timeout: 30000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).replace(/^\uFEFF/, ""),
  );
  if (
    safe.projectRef !== project ||
    safe.organizationId !== organization ||
    safe.operation !== "--inspect" ||
    safe.signupDisabled !== true ||
    safe.anonymousSigninsDisabled !== true ||
    safe.phoneSignupsDisabled !== true ||
    safe.emailSignInEnabled !== true ||
    safe.customSmtpConfigured !== false ||
    safe.beforeEmailQuota !== 2
  )
    throw Error("Exact closed project identity required");
  return {
    projectAndOrganizationVerified: true,
    signupDisabled: true,
    externalSendingNotEnabled: true,
    emailQuotaUnchanged: 2,
  };
}

async function closedBaseline(sql: Sql) {
  const [state] = await sql`select
    (select count(*)::int from supabase_migrations.schema_migrations) migrations,
    (select max(version) from supabase_migrations.schema_migrations) latest,
    (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity) unprotected_tables,
    (select count(*)::int from private.feature_flags where enabled) enabled_flags,
    (select count(*)::int from private.region_policies where approved and not preview_community_only) ordinary_approvals,
    (select count(*)::int from preview_auth.configuration where enabled) enabled_capture,
    (select count(*)::int from preview_auth.captured_mail) captured_mail,
    (select count(*)::int from private.events) sporting_events,
    (select count(*)::int from private.odds_snapshots) odds_snapshots,
    (select count(*)::int from private.tip_publications) official_publications,
    (select count(*)::int from private.community_edges) community_edges,
    (select count(*)::int from private.market_references) market_references,
    (select count(*)::int from private.delivery_attempts) delivery_attempts,
    (select count(*)::int from private.outbox where state='sent') sent_outbox,
    (select count(*)::int from private.roles) staff_roles`;
  if (
    state.migrations !== 9 ||
    state.latest !== "20261003062615" ||
    Object.entries(state).some(
      ([key, value]) => !["migrations", "latest"].includes(key) && value !== 0,
    )
  )
    throw Error("Closed empty-sports baseline required");
  return state;
}

async function ownerFingerprint(sql: Sql) {
  const [owner] = await sql`select p.id,to_jsonb(p) profile,
    jsonb_build_object('email',u.email,'passwordHash',u.encrypted_password,'appMetadata',u.raw_app_meta_data,'userMetadata',u.raw_user_meta_data,'emailConfirmedAt',u.email_confirmed_at,'bannedUntil',u.banned_until) authentication,
    (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]') from private.consent_events c where c.user_id=p.id) consent,
    (select to_jsonb(n) from public.notification_preferences n where n.user_id=p.id) preferences,
    (select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from private.preview_tester_access g where g.user_id=p.id) grants,
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from private.region_policies r where r.id in(select policy_id from private.preview_tester_access where user_id=p.id)) policies,
    (select to_jsonb(s) from private.social_profiles s where s.user_id=p.id) social
    from public.profiles p join auth.users u on u.id=p.id where u.email=${ownerEmail}`;
  if (!owner) throw Error("Protected owner boundary missing");
  return {
    id: String(owner.id),
    hash: hash(JSON.stringify(owner)),
    credentialHash: hash(await readFile(ownerCredentialPath)),
  };
}

function validateJournal(journal: Journal) {
  if (
    journal.projectRef !== project ||
    journal.organizationId !== organization ||
    !uuid.test(journal.runId) ||
    journal.qaFixture !== true ||
    journal.disposable !== true ||
    journal.email !== expectedEmail(journal.runId) ||
    journal.email === ownerEmail ||
    !["prepared", "auth-created", "ready", "erased"].includes(journal.state) ||
    (journal.id !== undefined && !uuid.test(journal.id)) ||
    (journal.socialProfileId !== undefined &&
      !uuid.test(journal.socialProfileId)) ||
    !/^[a-f0-9]{64}$/.test(journal.ownerHash) ||
    !/^[a-f0-9]{64}$/.test(journal.ownerCredentialHash)
  )
    throw Error("Exact disposable journal required");
}

async function main() {
  let sql: Sql | undefined;
  let stage = "arguments";
  try {
    const mode = process.argv[2];
    if (mode === "--help" && process.argv.length === 3) {
      console.log(
        "Operator only: --plan (read-only); --provision --confirm-project=<Docked Preview ref>; --cleanup --confirm-project=<Docked Preview ref> --qa-released. New mobile-app-ux private journal only. No signup, email, owner mutation or sporting data.",
      );
      return;
    }
    if (
      !["--plan", "--provision", "--cleanup"].includes(mode) ||
      (mode === "--plan"
        ? process.argv.length !== 3
        : process.argv[3] !== `--confirm-project=${project}`) ||
      (mode === "--provision" && process.argv.length !== 4) ||
      (mode === "--cleanup" &&
        (process.argv.length !== 5 || process.argv[4] !== "--qa-released"))
    )
      throw Error("Explicit scoped operator mode required");
    stage = "environment";
    const connection = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    if (
      connection.projectRef !== project ||
      connection.organizationId !== organization ||
      connection.supabaseUrl !== `https://${project}.supabase.co` ||
      process.env.DATABASE_URL !== connection.databaseUrl ||
      process.env.SUPABASE_SECRET_KEY !== connection.secretKey ||
      !connection.secretKey?.startsWith("sb_secret_") ||
      !previewDatabaseBound(process.env) ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== connection.supabaseUrl ||
      process.env.DOCKED_HOSTED_PREVIEW !== "true" ||
      process.env.SITE_URL !== origin
    )
      throw Error("Exact isolated environment required");
    assertHostedPreview(process.env);
    // Fail closed if private output would be tracked. No private file values are printed.
    execFileSync("git", ["check-ignore", "--quiet", "--", fixturePath], {
      stdio: "ignore",
      windowsHide: true,
    });
    stage = "management-read";
    const management = inspectProject();
    sql = db();
    stage = "baseline-read";
    const baseline = await closedBaseline(sql);
    const owner = await ownerFingerprint(sql);
    const [policy] =
      await sql`select p.id,p.effective_to,p.review_at from private.region_policies p
      join private.preview_tester_access g on g.policy_id=p.id
      where g.user_id=${owner.id} and g.revoked_at is null and g.expires_at>clock_timestamp()
      and p.preview_community_only and p.approved and p.country='XX' and p.state='DOCKED_PREVIEW'
      and p.minimum_age=18 and p.features @> array['community_social','public_profiles']::text[]
      and p.features <@ array['community_social','public_profiles']::text[] and cardinality(p.operators)=0
      and p.evidence like 'PREVIEW TEST ONLY:%' and p.effective_from<=clock_timestamp()
      and p.effective_to>clock_timestamp()+interval '30 minutes' and p.review_at>clock_timestamp()+interval '30 minutes'
      order by p.effective_from desc,p.id desc limit 1`;
    if (mode !== "--cleanup" && !policy)
      throw Error("Active existing preview-only policy required");
    if (mode === "--plan") {
      await receipt("plan", {
        ...management,
        baseline,
        mutations: false,
        scope:
          "One new disposable .invalid account; existing policy; four-hour maximum social/profile grant; owner untouched; no sporting records or outbound delivery.",
      });
      console.log(
        "Read-only mobile UX plan verified. No account, grant, policy or service configuration changed.",
      );
      return;
    }
    if (mode === "--provision") {
      stage = "fresh-run";
      await mkdir(output, { recursive: true });
      await absent(journalPath);
      await absent(fixturePath);
      const users = await sql`select id,email from auth.users`;
      if (
        users.length !== 1 ||
        users[0].id !== owner.id ||
        users[0].email !== ownerEmail
      )
        throw Error("Owner-only baseline required before a fresh run");
      const runId = randomUUID();
      const journal: Journal = {
        projectRef: project,
        organizationId: organization,
        runId,
        qaFixture: true,
        disposable: true,
        state: "prepared",
        createdAt: new Date().toISOString(),
        email: expectedEmail(runId),
        password: randomBytes(30).toString("base64url") + "Aa1!",
        ownerHash: owner.hash,
        ownerCredentialHash: owner.credentialHash,
      };
      await save(journal, true);
      stage = "auth-provision";
      const admin = createClient(connection.supabaseUrl, connection.secretKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const created = await admin.auth.admin.createUser({
        email: journal.email,
        password: journal.password,
        email_confirm: true,
        app_metadata: {
          preview_operator_provisioned: true,
          email_ownership_verified: false,
          qa_fixture: true,
          mobile_ux_run_id: runId,
        },
        user_metadata: {
          preview_label:
            "Disposable mobile UX QA; synthetic age and terms fixture; no real-world consent",
        },
      });
      if (
        created.error ||
        !created.data.user ||
        created.data.user.email !== journal.email ||
        !uuid.test(created.data.user.id)
      )
        throw Error("Auth creation requires private journal reconciliation");
      journal.id = created.data.user.id;
      journal.state = "auth-created";
      await save(journal);
      stage = "application-provision";
      const provisioned = await sql.begin(async (tx) => {
        const [lockedPolicy] =
          await tx`select id,least(effective_to,review_at,clock_timestamp()+interval '4 hours') expires_at
          from private.region_policies where id=${policy.id} and preview_community_only and approved
          and features @> array['community_social','public_profiles']::text[] and features <@ array['community_social','public_profiles']::text[]
          and cardinality(operators)=0 and effective_to>clock_timestamp()+interval '30 minutes' and review_at>clock_timestamp()+interval '30 minutes' for share`;
        if (!lockedPolicy) throw Error("Existing preview policy expired");
        const id = journal.id!;
        await tx`insert into public.profiles(id,country,state,age_attested,accepted_version,onboarding_completed_at,timezone)
          values(${id},'XX','PREVIEW_QA',true,'mobile-ux-qa-fixture-2026-10-03',clock_timestamp(),'Australia/Sydney')`;
        await tx`insert into public.notification_preferences(user_id,paused,digest,edge_alerts,education) values(${id},true,'off',false,false)`;
        await tx`insert into private.consent_events(user_id,purpose,granted,version,actor)
          values(${id},'qa_fixture_age_and_terms',true,'mobile-ux-qa-fixture-2026-10-03','mobile-ux-operator-synthetic-test')`;
        await tx`insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,granted_by,reason)
          values(${id},${lockedPolicy.id},${project},${lockedPolicy.expires_at},'mobile-ux-qa-operator','Disposable read-only mobile screen acceptance. Synthetic QA attestations, no legal approval or sporting claims.')`;
        const [social] =
          await tx`insert into private.social_profiles(user_id,handle,display_name,bio,visibility)
          values(${id},${`qa_mobile_${runId.replaceAll("-", "").slice(0, 12)}`},'QA Mobile Preview','Disposable interface acceptance account. No sporting performance or real-world identity claims.','private') returning id`;
        await tx`insert into private.social_notification_preferences(profile_id,in_app,social) values(${social.id},false,false)`;
        if ((await tx`select 1 from private.roles where user_id=${id}`).length)
          throw Error("Staff role forbidden");
        return {
          socialProfileId: String(social.id),
          policyId: String(lockedPolicy.id),
          expiresAt: (lockedPolicy.expires_at as Date).toISOString(),
        };
      });
      Object.assign(journal, provisioned, { state: "ready" });
      await save(journal);
      const ownerAfter = await ownerFingerprint(sql);
      if (
        ownerAfter.hash !== journal.ownerHash ||
        ownerAfter.credentialHash !== journal.ownerCredentialHash
      )
        throw Error("Owner fingerprint changed");
      await closedBaseline(sql);
      await writeFile(
        fixturePath,
        JSON.stringify(
          {
            projectRef: project,
            organizationId: organization,
            origin,
            qaFixture: true,
            disposable: true,
            runId,
            createdAt: journal.createdAt,
            expiresAt: journal.expiresAt,
            member: {
              id: journal.id,
              email: journal.email,
              password: journal.password,
            },
          },
          null,
          2,
        ) + "\n",
        { mode: 0o600, flag: "wx" },
      );
      await receipt("provision", {
        ...management,
        preparedAccountCount: 1,
        expiresAt: journal.expiresAt,
        emailSent: false,
        operatorConfirmedNotEmailVerified: true,
        syntheticAttestations: true,
        existingPolicyUnchanged: true,
        features: ["community_social", "public_profiles"],
        ownerFingerprintUnchanged: true,
        noSportingRecordsOrPerformanceCreated: true,
        acceptanceExecuted: false,
      });
      console.log(
        "One disposable mobile UX account prepared; private acceptance.json saved. Owner unchanged, no email, performance or policy activation. Browser acceptance has not run.",
      );
      return;
    }
    stage = "cleanup-scope";
    const journal: Journal = JSON.parse(await readFile(journalPath, "utf8"));
    validateJournal(journal);
    if (
      owner.hash !== journal.ownerHash ||
      owner.credentialHash !== journal.ownerCredentialHash
    )
      throw Error("Protected owner changed; review without mutating it");
    const matches =
      await sql`select id,email,raw_app_meta_data from auth.users where email=${journal.email} or id=${journal.id ?? null}::uuid`;
    if (matches.length > 1) throw Error("Ambiguous cleanup target");
    if (matches.length) {
      const target = matches[0];
      if (
        target.id === owner.id ||
        target.email !== expectedEmail(journal.runId) ||
        (journal.id && target.id !== journal.id) ||
        target.raw_app_meta_data?.qa_fixture !== true ||
        target.raw_app_meta_data?.mobile_ux_run_id !== journal.runId
      )
        throw Error("Disposable Auth identity mismatch");
      journal.id = String(target.id);
      await save(journal);
    }
    if (journal.id === owner.id) throw Error("Owner is never a cleanup target");
    stage = "revoke-and-erase";
    if (journal.id) {
      const [social] =
        await sql`select id from private.social_profiles where user_id=${journal.id}`;
      if (social) {
        if (journal.socialProfileId && journal.socialProfileId !== social.id)
          throw Error("QA social identity mismatch");
        journal.socialProfileId = String(social.id);
        await save(journal);
      }
      // disable_account revokes all sessions and pseudonymises social data first.
      // Auth deletion is then performed by the same account-erasure service as the app.
      await sql`select private.disable_account(${journal.id})`;
      await processAccountDeletion(journal.id);
      await sql`update private.job_runs set state='done',payload='{}',lease_token=null,lease_until=null,last_success=clock_timestamp()
        where kind='account_deletion' and dedupe_key=${`account-deletion:${journal.id}`}`;
      const [remaining] = await sql`select
        (select count(*)::int from auth.users where id=${journal.id} or email=${journal.email}) auth,
        (select count(*)::int from auth.sessions where user_id=${journal.id}) sessions,
        (select count(*)::int from auth.refresh_tokens where user_id=${journal.id}) refresh_tokens,
        (select count(*)::int from public.profiles where id=${journal.id}) profiles,
        (select count(*)::int from private.preview_tester_access where user_id=${journal.id}) grants,
        (select count(*)::int from private.social_profiles where user_id=${journal.id}) identifiable_social,
        (select count(*)::int from private.analytics_events where user_id=${journal.id}) analytics,
        (select count(*)::int from private.roles where user_id=${journal.id}) roles,
        (select count(*)::int from private.social_profiles where id=${journal.socialProfileId ?? null}::uuid and
          (user_id is not null or status<>'deleted' or display_name<>'Deleted member' or bio<>'' or avatar_media_id is not null)) retained_identity,
        (select count(*)::int from private.social_posts where author_id=${journal.socialProfileId ?? null}::uuid and (body<>'' or deleted_at is null or moderation_status<>'removed')) retained_commentary,
        (select count(*)::int from private.social_comments where author_id=${journal.socialProfileId ?? null}::uuid and (body<>'' or deleted_at is null or moderation_status<>'removed')) retained_comments,
        (select count(*)::int from private.social_media where owner_id=${journal.socialProfileId ?? null}::uuid and content is not null) retained_media,
        (select count(*)::int from private.social_notifications where recipient_id=${journal.socialProfileId ?? null}::uuid or actor_id=${journal.socialProfileId ?? null}::uuid) retained_notifications,
        (select count(*)::int from private.social_follows where actor_id=${journal.socialProfileId ?? null}::uuid or target_id=${journal.socialProfileId ?? null}::uuid) retained_follows`;
      if (Object.values(remaining).some((count) => count !== 0))
        throw Error("QA erasure incomplete");
    }
    stage = "cleanup-verification";
    const final = await closedBaseline(sql);
    const after = await ownerFingerprint(sql);
    if (
      after.hash !== journal.ownerHash ||
      after.credentialHash !== journal.ownerCredentialHash
    )
      throw Error("Owner fingerprint changed");
    const [roster] =
      await sql`select (select count(*)::int from auth.users) auth,(select count(*)::int from public.profiles) profiles,(select count(*)::int from private.preview_tester_access) grants`;
    if (roster.auth !== 1 || roster.profiles !== 1 || roster.grants !== 1)
      throw Error("Final owner-only roster required");
    journal.password = "[ERASED]";
    journal.state = "erased";
    await save(journal);
    await writeFile(
      fixturePath,
      JSON.stringify(
        {
          projectRef: project,
          qaFixture: true,
          disposable: true,
          cleanupCompletedAt: new Date().toISOString(),
          credentialsErased: true,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    await receipt("cleanup", {
      ...management,
      final,
      roster,
      ownerFingerprintUnchanged: true,
      ownerCredentialFileUnchanged: true,
      qaAccessRevokedAndAuthErased: true,
      qaCredentialsRedacted: true,
      sharedPreviewPolicyNotModified: true,
      note: "Disposable identity erased using ordinary account-erasure service; pseudonymous audit/tombstone evidence retained without identifying social data. Earlier QA journals and owner credentials were not modified.",
    });
    console.log(
      "Mobile UX QA identity and access erased; new credentials redacted. Owner and shared policy unchanged. Sanitized cleanup receipt saved.",
    );
  } catch {
    console.error(
      `Mobile UX operator stopped at ${stage}. No credentials, identifiers or private response emitted. Review the new private journal before retrying; never rerun provisioning blindly.`,
    );
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}
void main();
