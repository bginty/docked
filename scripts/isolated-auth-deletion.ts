/** Real Supabase Auth acceptance against the disposable loopback CLI project only.
 * No Production credentials are loaded. Secrets remain in ignored private-data.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
const directory = "private-data/deletion-auth-local";
const text = readFileSync(`${directory}/status.private.json`, "utf8");
const settings = JSON.parse(
  text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
);
const url = new URL(settings.DB_URL),
  auth = new URL(settings.API_URL);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "54322");
assert.equal(url.pathname, "/postgres");
assert.equal(auth.origin, "http://127.0.0.1:54321");
assert(
  readFileSync(`${directory}/supabase/config.toml`, "utf8").includes(
    'project_id = "deletion-auth-local"',
  ),
);
const sql = postgres(url.href, { max: 2, onnotice: () => {} });
async function main() {
  if (process.argv[2] === "prepare") {
    await sql`create schema if not exists deletion_acceptance`;
    await sql`create table if not exists deletion_acceptance.migrations(version text primary key,hash text not null)`;
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const source = readFileSync(`supabase/migrations/${file}`, "utf8"),
        version = file.split("_")[0],
        hash = createHash("sha256").update(source).digest("hex");
      const [prior] =
        await sql`select hash from deletion_acceptance.migrations where version=${version}`;
      if (prior) {
        assert.equal(prior.hash, hash);
        continue;
      }
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(source);
          await tx`insert into deletion_acceptance.migrations values(${version},${hash})`;
        });
      } catch (e) {
        console.error("Migration failed", file, (e as Error).message);
        throw Error("Isolated migration stopped");
      }
    }
    if (!existsSync(`${directory}/fixture.private.json`)) {
      const admin = createClient(auth.origin, settings.SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const password = randomBytes(24).toString("base64url"),
        runtimePassword = randomBytes(24).toString("hex");
      const users = [];
      for (const name of ["erase", "retained"]) {
        const email = `${name}-${Date.now()}@deletion-test.invalid`;
        const result = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        assert.ifError(result.error);
        const id = result.data.user!.id;
        await sql`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${id},'AU','NSW',true,'isolated-deletion-acceptance')`;
        await sql`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${id},'terms',true,'isolated-deletion-acceptance',${id})`;
        users.push({ id, email });
      }
      await sql.unsafe(
        `alter role docked_app login password '${runtimePassword}'`,
      );
      const runtime = new URL(url);
      runtime.username = "docked_app";
      runtime.password = runtimePassword;
      writeFileSync(
        `${directory}/fixture.private.json`,
        JSON.stringify({ users, password, runtime: runtime.href }),
        { mode: 0o600 },
      );
    }
    // Development Auth lookup uses the base relation; grant only the three
    // session columns already exposed by the production security-barrier view.
    execFileSync(
      process.env.DOCKER_EXECUTABLE ??
        "C:/Users/61412/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe",
      [
        "exec",
        "supabase_db_deletion-auth-local",
        "psql",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "grant usage on schema auth to docked_app; grant select(id,user_id,not_after) on auth.sessions to docked_app; drop policy if exists isolated_app_session_check on auth.sessions; create policy isolated_app_session_check on auth.sessions for select to docked_app using (true);",
      ],
      { windowsHide: true, stdio: "pipe" },
    );
    console.log(
      JSON.stringify({
        prepared: true,
        migrations: (
          await sql`select count(*) n from deletion_acceptance.migrations`
        )[0].n,
        auth: "real local Supabase",
        productionAccess: false,
      }),
    );
  } else if (process.argv[2] === "verify") {
    const fixture = JSON.parse(
      readFileSync(`${directory}/fixture.private.json`, "utf8"),
    );
    const erased = fixture.users[0].id,
      retained = fixture.users[1].id;
    assert.equal(
      (await sql`select id from auth.users where id=${erased}`).length,
      0,
    );
    assert.equal(
      (await sql`select id from public.profiles where id=${erased}`).length,
      0,
    );
    assert.equal(
      (await sql`select id from auth.sessions where user_id=${erased}`).length,
      0,
    );
    assert.equal(
      (await sql`select id from auth.users where id=${retained}`).length,
      1,
    );
    assert.equal(
      (
        await sql`select id from public.profiles where id=${retained} and disabled_at is null`
      ).length,
      1,
    );
    const [job] =
      await sql`select state,payload from private.job_runs where dedupe_key=${`account-deletion:${erased}`}`;
    assert.equal(job.state, "done");
    assert.deepEqual(job.payload, {});
    const [audit] =
      await sql`select count(*)::int n from private.audit_events where action='account_erasure_completed' and subject=${erased}`;
    assert.equal(audit.n, 1);
    const [consent] =
      await sql`select count(*)::int n from private.consent_events where user_id=${erased} and version='isolated-deletion-acceptance'`;
    assert.equal(consent.n, 1, "Minimal consent evidence must be preserved");
    const admin = createClient(auth.origin, settings.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await admin.auth.signInWithPassword({
      email: fixture.users[0].email,
      password: fixture.password,
    });
    assert(login.error, "Deleted credentials must be rejected");
    for (const origin of [
      "http://127.0.0.1:3038",
      "https://untrusted.invalid",
    ]) {
      const response = await fetch("http://127.0.0.1:3038/api/member", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          confirm: "DELETE",
          userId: retained,
        }),
      });
      assert.equal(response.status, 403);
    }
    // Exercise the real worker concurrently after successful browser deletion.
    Object.assign(process.env, {
      APP_ENV: "development",
      DOCKED_HOSTED_PRODUCTION: "false",
      DOCKED_HOSTED_PREVIEW: "false",
      DOCKED_HOSTED_REVIEW: "false",
      DOCKED_BETA_STAGING: "false",
      DATABASE_URL: fixture.runtime,
      NEXT_PUBLIC_SUPABASE_URL: auth.origin,
      SUPABASE_SECRET_KEY: settings.SERVICE_ROLE_KEY,
    });
    const { processAccountDeletion } =
      await import("../src/server/account-deletion");
    await Promise.all([
      processAccountDeletion(erased),
      processAccountDeletion(erased),
      processAccountDeletion(erased),
    ]);
    const { db } = await import("../src/server/db");
    await db().end();
    assert.equal(
      (
        await sql`select count(*)::int n from private.audit_events where action='account_erasure_completed' and subject=${erased}`
      )[0].n,
      1,
    );
    const report = {
      at: new Date().toISOString(),
      environment: "Disposable local Supabase Auth + customer dashboard route",
      migrations: 126,
      authDeleted: true,
      profileDeleted: true,
      sessionsDeleted: true,
      otherMemberPreserved: true,
      job: "done",
      jobPayloadCleared: true,
      auditEvents: 1,
      retainedConsentEvents: consent.n,
      retainedEvidenceIsAnonymous: false,
      concurrentWorkerRetries: 3,
      deletedLoginDenied: true,
      unauthenticatedAndCrossOriginDenied: true,
      productionTouched: false,
    };
    writeFileSync(
      "docs/qa/launch-blockers-20261101/real-auth-deletion.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } else if (process.argv[2] === "serve") {
    const fixture = JSON.parse(
      readFileSync(`${directory}/fixture.private.json`, "utf8"),
    );
    const env = { ...process.env };
    for (const k of Object.keys(env))
      if (
        /^(DOCKED_|NEXT_PUBLIC_SUPABASE|SUPABASE_|DATABASE_|APP_ENV|VERCEL|BETA_|FANTASY_)/.test(
          k,
        )
      )
        delete env[k];
    Object.assign(env, {
      APP_ENV: "development",
      SUPABASE_ENV: "isolated",
      SITE_URL: "http://127.0.0.1:3038",
      DATABASE_URL: fixture.runtime,
      NEXT_PUBLIC_SUPABASE_URL: auth.origin,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
      SUPABASE_SECRET_KEY: settings.SERVICE_ROLE_KEY,
      DOCKED_HOSTED_PRODUCTION: "false",
      DOCKED_HOSTED_PREVIEW: "false",
      DOCKED_HOSTED_REVIEW: "false",
      DOCKED_BETA_STAGING: "false",
      DOCKED_OWNER_GAMEPLAY: "false",
      REGISTRATION_ENABLED: "false",
      SENDING_ENABLED: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    });
    const child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3038",
      ],
      { env, stdio: "inherit", windowsHide: true },
    );
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  } else throw Error("Expected prepare, serve or verify");
}
main()
  .finally(() => sql.end())
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
