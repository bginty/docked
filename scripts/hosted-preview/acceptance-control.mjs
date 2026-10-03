// Operator-only controls for the explicitly authorised, isolated Docked Preview.
// Never import this file into application code. All credentials stay ignored.
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const projectRef = "bckkllmndoxzpzdqrevb";
const organizationId = "ernfnkcbalhyqpsrzdwa";
const siteOrigin = "http://localhost:3000";
const directory = new URL(
  "../../private-data/hosted-preview/",
  import.meta.url,
);
const mode = process.argv[2];
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, directory), "utf8"));
const write = async (name, value) =>
  writeFile(new URL(name, directory), JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
let sql;
try {
  const connection = await read("connection.json");
  const database = new URL(connection.databaseUrl);
  if (
    connection.projectRef !== projectRef ||
    connection.organizationId !== organizationId ||
    connection.supabaseUrl !== `https://${projectRef}.supabase.co` ||
    database.hostname !== "aws-0-ap-southeast-2.pooler.supabase.com" ||
    database.port !== "5432" ||
    decodeURIComponent(database.username) !== `postgres.${projectRef}` ||
    database.pathname !== "/postgres"
  )
    throw new Error("identity");
  sql = postgres(connection.databaseUrl, {
    host: [database.hostname],
    port: [5432],
    max: 1,
    prepare: false,
    ssl: {
      rejectUnauthorized: true,
      ca: await readFile(connection.caFile, "utf8"),
    },
    connect_timeout: 15,
  });
  if (mode === "upgrade-capture-diagnostics") {
    await sql`select set_config('docked.preview_project_ref',${projectRef},false)`;
    await sql.unsafe(
      await readFile(
        new URL(
          "../../docs/qa/hosted-preview/upgrade-auth-capture-diagnostics.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    console.log(
      "Static capture diagnostics upgraded; any prior proof invalidated.",
    );
  } else if (mode === "install-capture") {
    await sql`select set_config('docked.preview_project_ref',${projectRef},false)`;
    await sql.unsafe(
      await readFile(
        new URL(
          "../../docs/qa/hosted-preview/setup-auth-capture.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    console.log(
      "Preview capture schema installed disabled. Auth signup remains closed.",
    );
  } else if (mode === "prepare-roster") {
    try {
      await read("acceptance.json");
      throw new Error("roster already exists");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const accounts = {};
    for (const [label, alias] of Object.entries({
      memberA: "member-a",
      memberB: "member-b",
      restricted: "restricted",
      analyst: "analyst",
      editor: "editor",
      admin: "admin",
      auditor: "auditor",
    }))
      accounts[label] = {
        email: `docked-preview-${alias}-20261003@example.invalid`,
        password: randomBytes(32).toString("hex"),
        recoveryPassword: randomBytes(32).toString("hex"),
        handle: `dck_${(alias === "admin" ? "staff_a" : alias).replaceAll("-", "_")}_1003`,
        country: "AU",
        state: label === "restricted" ? "WA" : "NSW",
      };
    const canary = {
      email: "docked-preview-canary-20261003@example.invalid",
      password: randomBytes(32).toString("hex"),
    };
    await write("canary.json", canary);
    await write("acceptance.json", {
      projectRef,
      organizationId,
      siteOrigin,
      supabaseUrl: connection.supabaseUrl,
      runId: "20261003",
      mailHook: { verified: false, externalDeliveryDisabled: true },
      capabilities: {
        community: false,
        privileged: false,
        deleteAccounts: false,
      },
      accounts,
    });
    await sql.begin(async (tx) => {
      await tx`update preview_auth.configuration set enabled=true,configured_at=clock_timestamp(),expires_at=clock_timestamp()+interval '12 hours',hook_verified_at=null,hook_verified_event_id=null,hook_function_sha256=null where singleton`;
      for (const account of [...Object.values(accounts), canary])
        await tx`insert into preview_auth.allowed_recipients(email,expires_at) values(${account.email},clock_timestamp()+interval '12 hours')`;
    });
    console.log(
      "Exact reserved account roster prepared privately; twelve-hour capture allowlist installed.",
    );
  } else if (mode === "renew-capture") {
    const fixture = await read("acceptance.json"),
      canary = await read("canary.json");
    const emails = [
      ...Object.values(fixture.accounts).map((a) => a.email),
      canary.email,
    ];
    if (
      fixture.projectRef !== projectRef ||
      emails.some(
        (email) =>
          !/^docked-preview-[a-z0-9][a-z0-9-]{0,63}@example[.]invalid$/.test(
            email,
          ),
      )
    )
      throw new Error("exact reserved roster");
    await sql.begin(async (tx) => {
      await tx`update preview_auth.configuration set enabled=true,configured_at=clock_timestamp(),expires_at=clock_timestamp()+interval '12 hours',hook_verified_at=null,hook_verified_event_id=null,hook_function_sha256=null where singleton`;
      for (const email of emails)
        await tx`insert into preview_auth.allowed_recipients(email,approved_at,expires_at) values(${email},clock_timestamp(),clock_timestamp()+interval '12 hours') on conflict(email) do update set approved_at=excluded.approved_at,expires_at=excluded.expires_at,revoked_at=null`;
    });
    fixture.mailHook.verified = false;
    await write("acceptance.json", fixture);
    console.log(
      "Exact reserved capture approvals renewed; fresh genuine hook proof still required.",
    );
  } else if (mode === "enable-app") {
    const ready = await read("readiness.json");
    if (
      ready.projectRef !== projectRef ||
      Date.parse(ready.expiresAt) <= Date.now()
    )
      throw new Error("capture proof");
    const envPath = new URL("../../.env.local", import.meta.url);
    let env = await readFile(envPath, "utf8");
    const existingUnsubscribeSecret = env.match(
      /^UNSUBSCRIBE_SECRET=([a-f0-9]{64})$/m,
    )?.[1];
    for (const [key, value] of Object.entries({
      PREVIEW_AUTH_CAPTURE_MODE: "verified_db_hook",
      PREVIEW_AUTH_PROJECT_REF: projectRef,
      REGISTRATION_ENABLED: "true",
      UNSUBSCRIBE_SECRET:
        existingUnsubscribeSecret ?? randomBytes(32).toString("hex"),
    })) {
      const pattern = new RegExp(`^${key}=.*$`, "m");
      env = pattern.test(env)
        ? env.replace(pattern, `${key}=${value}`)
        : env + `\n${key}=${value}\n`;
    }
    await writeFile(envPath, env, { mode: 0o600 });
    await sql`update private.feature_flags set enabled=true,reason='Isolated exact-recipient hosted acceptance; twelve-hour capture approval; no public registration',updated_at=clock_timestamp() where key='registration'`;
    console.log(
      "Allowlisted preview app registration configured. All sending/publication/paper/commercial flags remain off.",
    );
  } else if (mode === "grant-roles") {
    const fixture = await read("acceptance.json"),
      state = await read("state.json");
    await sql.begin(async (tx) => {
      for (const label of ["analyst", "editor", "admin", "auditor"]) {
        const id = state.accounts[label]?.id;
        const verified =
          await tx`select p.id from public.profiles p join auth.users u on u.id=p.id where p.id=${id} and u.email=${fixture.accounts[label].email} and u.email_confirmed_at is not null and p.disabled_at is null`;
        if (verified.length !== 1) throw new Error("genuine account required");
        await tx`insert into private.roles(user_id,role) values(${id},${label})`;
        await tx`insert into private.audit_events(actor,action,subject,details) values('preview-acceptance-operator','qa_role_assignment',${id},${tx.json({ role: label, scope: "isolated hosted acceptance only" })})`;
      }
      await tx`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values('AU','NSW','qa-only-20261003',clock_timestamp(),clock_timestamp()+interval '4 hours',clock_timestamp()+interval '4 hours',true,18,${["community_social", "public_profiles"]},'TEST ONLY: synthetic access-policy fixture for reserved QA identities on isolated Docked Preview. No legal approval, real tips, public launch or marketing authority.')`;
    });
    fixture.capabilities = {
      community: true,
      privileged: true,
      deleteAccounts: true,
    };
    await write("acceptance.json", fixture);
    console.log(
      "Four staff roles assigned to genuine verified QA users; four-hour social-only QA policy installed.",
    );
  } else if (mode === "revoke-policy") {
    await sql`update private.region_policies set approved=false where version='qa-only-20261003' and country='AU' and state='NSW'`;
    await write("policy-revocation.json", {
      projectRef,
      policyRevokedAt: new Date().toISOString(),
    });
    console.log("Isolated social QA policy revoked.");
  } else if (mode === "inspect-auth-token-shape") {
    const canary = await read("canary.json");
    const admin = createClient(connection.supabaseUrl, connection.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: canary.email,
      password: canary.password,
      options: { redirectTo: `${siteOrigin}/auth/callback` },
    });
    if (error || !data.properties || !data.user)
      throw new Error("admin link generation failed");
    await write("canary.json", { ...canary, id: data.user.id });
    const link = new URL(data.properties.action_link);
    console.log(
      JSON.stringify({
        operation:
          "No-delivery admin link shape inspection; not signup acceptance",
        tokenLength: data.properties.hashed_token.length,
        hexToken: /^(pkce_)?[a-f0-9]{40,256}$/.test(
          data.properties.hashed_token,
        ),
        verificationType: data.properties.verification_type,
        exactCallback:
          link.searchParams.get("redirect_to") ===
          `${siteOrigin}/auth/callback`,
        authExternalBase: link.origin + link.pathname.replace(/\/verify$/, ""),
        hasNewEmail: !!data.user.new_email,
      }),
    );
  } else if (mode === "prove-capture") {
    // Run only AFTER independently verifying the remote Send Email hook configuration.
    const canary = await read("canary.json");
    const client = createClient(
      connection.supabaseUrl,
      connection.publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const started = new Date();
    const { data, error } = await client.auth.signUp({
      ...canary,
      options: { emailRedirectTo: `${siteOrigin}/auth/callback` },
    });
    if (error)
      await write("last-provider-error.json", {
        code: error.code,
        status: error.status,
        message: error.message,
      });
    if (error || !data.user || data.session || data.user.email_confirmed_at)
      throw new Error("canary signup");
    const captured =
      await sql`select id,received_at,expires_at from preview_auth.captured_mail where email=${canary.email} and auth_user_id=${data.user.id} and action='signup' and received_at>=${started} order by received_at desc limit 1`;
    if (captured.length !== 1) throw new Error("genuine capture absent");
    await write("canary.json", { ...canary, id: data.user.id });
    await sql`update preview_auth.configuration set hook_verified_at=clock_timestamp(),hook_verified_event_id=${captured[0].id},hook_function_sha256=encode(sha256(convert_to(pg_get_functiondef('preview_auth.capture_email(jsonb)'::regprocedure),'UTF8')),'hex') where singleton`;
    const [proof] =
      await sql`select hook_verified_at,hook_function_sha256 from preview_auth.configuration where singleton`;
    await write("readiness.json", {
      projectRef,
      siteUrl: siteOrigin,
      authHookUri: "pg-functions://postgres/preview_auth/capture_email",
      hookVerifiedAt: proof.hook_verified_at.toISOString(),
      hookFunctionSha256: proof.hook_function_sha256,
      expiresAt: captured[0].expires_at.toISOString(),
    });
    const fixture = await read("acceptance.json");
    fixture.mailHook = {
      verified: true,
      verifiedAt: proof.hook_verified_at.toISOString(),
      externalDeliveryDisabled: true,
    };
    await write("acceptance.json", fixture);
    console.log(
      "Genuine hosted signup reached the SQL capture hook; no session before email verification. Proof expires in at most thirty minutes.",
    );
  } else throw new Error("unknown action");
} catch (error) {
  await write("last-control-error.json", {
    code: error.code,
    message: error.message,
  }).catch(() => {});
  // Do not surface provider/SQL messages: they may contain credential-bearing context.
  console.error(
    `Hosted preview ${mode ?? "action"} failed (${error.code ?? "guard or acceptance failure"}). Inspect the private state; no secrets printed.`,
  );
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 5 });
}
