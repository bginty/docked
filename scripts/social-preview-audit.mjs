// Fixed Preview target, read-only catalog and aggregate admission evidence only.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import postgres from "postgres";
const ref = "bckkllmndoxzpzdqrevb";
const config = JSON.parse(
  await readFile("private-data/hosted-preview/connection.json", "utf8"),
);
if (
  config.projectRef !== ref ||
  new URL(config.supabaseUrl).hostname !== `${ref}.supabase.co`
)
  throw Error("Preview identity denied");
const url = new URL(config.databaseUrl);
if (
  url.hostname !== `db.${ref}.supabase.co` &&
  !(
    url.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(url.username) === `postgres.${ref}` &&
    url.port === "5432"
  )
)
  throw Error("Preview database denied");
const sql = postgres(config.databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
});
try {
  const identities = await Promise.all(
    [
      ["Owner", "private-data/member-invitations/briant-owner-20261003.json"],
      ["Barry", "private-data/barry-invitation/eligibility.json"],
      ["Luke", "private-data/friend-invite-lbickley/invitation.private.json"],
    ].map(async ([label, path]) => ({
      label,
      email: JSON.parse(await readFile(path, "utf8")).email,
    })),
  );
  if (
    identities.some(
      (i) => typeof i.email !== "string" || !i.email.includes("@"),
    )
  )
    throw Error("Verified recipient evidence missing");
  const audit = await sql.begin("read only", async (tx) => ({
    migrations:
      await tx`select version,name from supabase_migrations.schema_migrations order by version`,
    schemas:
      await tx`select nspname from pg_namespace where nspname in ('beta_private','fantasy','credits_sandbox','private','preview_auth') order by 1`,
    auth: await tx`select count(*)::int accounts,count(*) filter(where email_confirmed_at is not null)::int confirmed from auth.users`,
    roles:
      await tx`select rolname from pg_roles where rolname in ('docked_app','docked_beta_app')`,
    tables:
      await tx`select schemaname,tablename from pg_tables where schemaname in ('beta_private','fantasy','credits_sandbox','preview_auth') order by 1,2`,
    testers: await Promise.all(
      identities.map(async (i) => {
        const [row] =
          await tx`select count(*)::int accounts,count(*) filter(where email_confirmed_at is not null)::int confirmed from auth.users where lower(email)=lower(${i.email})`;
        return {
          tester: i.label,
          ...row,
          recipientFromExistingInvitationRecord: true,
        };
      }),
    ),
  }));
  const applied = new Set(audit.migrations.map((m) => m.version));
  const missing = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && !applied.has(f.split("_")[0]))
    .sort();
  const output = {
    at: new Date().toISOString(),
    projectRef: ref,
    readOnly: true,
    ...audit,
    missing,
  };
  await mkdir("docs/qa/social-visual-preview", { recursive: true });
  await writeFile(
    "docs/qa/social-visual-preview/preview-schema.json",
    JSON.stringify(output, null, 2),
  );
  console.log(
    JSON.stringify({
      projectRef: ref,
      applied: audit.migrations.length,
      last: audit.migrations.at(-1),
      missing,
      auth: audit.auth,
      schemas: audit.schemas,
    }),
  );
} catch (e) {
  console.error(
    "Preview audit failed",
    /^[A-Z0-9_]+$/.test(e.code ?? "") ? e.code : "details withheld",
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
