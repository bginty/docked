// Operator-only teardown of the exact reserved roster after hosted acceptance.
// Run with --conditions=react-server --env-file=.env.local --import tsx.
import { readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "../../src/server/db";
import { processAccountDeletion } from "../../src/server/account-deletion";
const project = "bckkllmndoxzpzdqrevb";
const directory = pathToFileURL(resolve("private-data/hosted-preview") + sep);
const read = async (name: string) =>
  JSON.parse(await readFile(new URL(name, directory), "utf8"));
let sql: ReturnType<typeof db> | undefined;
async function main() {
  try {
    const connection = await read("connection.json");
    const fixture = await read("acceptance.json");
    const state = await read("state.json");
    const canary = await read("canary.json");
    if (
      process.argv[2] !== "--erase-reserved-qa-accounts" ||
      connection.projectRef !== project ||
      fixture.projectRef !== project ||
      connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
      process.env.DATABASE_URL !== connection.databaseUrl ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !==
        `https://${project}.supabase.co` ||
      process.env.APP_ENV !== "preview" ||
      process.env.SUPABASE_ENV !== "preview" ||
      process.env.SITE_URL !== "http://localhost:3000" ||
      process.env.REGISTRATION_ENABLED !== "false" ||
      process.env.SENDING_ENABLED === "true"
    )
      throw new Error("Teardown scope denied");
    sql = db();
    const [capture] =
      await sql`select enabled from preview_auth.configuration where singleton`;
    if (
      capture?.enabled ||
      (await sql`select 1 from private.feature_flags where enabled`).length
    )
      throw new Error("Close capture and feature flags before teardown");
    const accounts = Object.entries(fixture.accounts).map(([label, value]) => ({
      label,
      email: (value as { email: string }).email,
      id: state.accounts[label]?.id as string,
    }));
    accounts.push({ label: "canary", email: canary.email, id: canary.id });
    if (
      accounts.length !== 8 ||
      new Set(accounts.map((a) => a.id)).size !== 8 ||
      new Set(accounts.map((a) => a.email)).size !== 8 ||
      accounts.some(
        (a) =>
          !a.id ||
          !/^docked-preview-[a-z0-9-]+@example[.]invalid$/.test(a.email),
      )
    )
      throw new Error("Exact genuine QA roster required");
    const checks = [];
    for (const account of accounts) {
      const users =
        await sql`select id,email from auth.users where email=${account.email} or id=${account.id}`;
      if (
        users.length &&
        (users.length !== 1 ||
          users[0].id !== account.id ||
          users[0].email !== account.email)
      )
        throw new Error("Genuine QA identity mismatch");
      await sql`select private.disable_account(${account.id})`;
      await processAccountDeletion(account.id);
      await sql`update private.job_runs set state='done',payload='{}',lease_token=null,lease_until=null,last_success=clock_timestamp() where kind='account_deletion' and dedupe_key=${`account-deletion:${account.id}`}`;
      const [remaining] = await sql`select
      (select count(*)::int from auth.users where id=${account.id}) as auth,
      (select count(*)::int from auth.sessions where user_id=${account.id}) as sessions,
      (select count(*)::int from public.profiles where id=${account.id}) as profiles,
      (select count(*)::int from private.social_profiles where user_id=${account.id}) as identifiable_social_profiles,
      (select count(*)::int from private.audit_events where subject=${account.id} and action='account_erasure_completed') as erasure_audits`;
      if (
        remaining.auth ||
        remaining.sessions ||
        remaining.profiles ||
        remaining.identifiable_social_profiles ||
        !remaining.erasure_audits
      )
        throw new Error("QA erasure verification failed");
      checks.push({ account: account.label, status: "PASS", ...remaining });
    }
    await writeFile(
      resolve("docs/qa/phase4/account-erasure-results.json"),
      JSON.stringify(
        {
          projectRef: project,
          recordedAt: new Date().toISOString(),
          checks,
          note: "Only the eight reserved QA identities were erased through the existing application erasure service. Immutable pseudonymous audit records retained.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Reserved QA erasure verified for ${checks.length} accounts; no identifiers or credentials emitted.`,
    );
  } catch {
    console.error(
      "Exact-roster teardown failed; no credentials emitted. Inspect scope before retrying.",
    );
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}
void main();
