// Root-operated acceptance helper. Never import into the application/client bundle.
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const projectRef = "bckkllmndoxzpzdqrevb";
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, "private-data", "hosted-preview");
const addresses = [...new Set(process.argv.slice(2))];
let sql;
try {
  if (
    process.env.APP_ENV !== "preview" ||
    process.env.SUPABASE_ENV !== "preview" ||
    process.env.SITE_URL !== "http://localhost:3000"
  )
    throw new Error("Environment gate");
  if (
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin !==
    `https://${projectRef}.supabase.co`
  )
    throw new Error("Project gate");
  const database = new URL(process.env.DATABASE_URL ?? "");
  const direct = database.hostname === `db.${projectRef}.supabase.co`;
  const session =
    database.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(database.username) === `postgres.${projectRef}` &&
    database.port === "5432";
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    (!direct && !session)
  )
    throw new Error("Database gate");
  if (
    !addresses.length ||
    addresses.length > 32 ||
    addresses.some(
      (email) =>
        !/^docked-preview-[a-z0-9][a-z0-9-]{0,63}@example\.invalid$/.test(
          email,
        ),
    )
  )
    throw new Error("Recipient gate");
  const receipt = JSON.parse(
    await readFile(path.join(directory, "readiness.json"), "utf8"),
  );
  if (
    receipt.projectRef !== projectRef ||
    receipt.siteUrl !== "http://localhost:3000" ||
    receipt.authHookUri !==
      "pg-functions://postgres/preview_auth/capture_email" ||
    !receipt.hookVerifiedAt ||
    !(Date.parse(receipt.expiresAt) > Date.now())
  )
    throw new Error("Readiness gate");
  const ca = await readFile(process.env.DATABASE_SSL_CA_FILE ?? path.join(root, "certs/supabase-prod-ca-2021.crt"), "utf8");
  sql = postgres(process.env.DATABASE_URL, {
    host: database.hostname,
    port: Number(database.port || 5432),
    username: decodeURIComponent(database.username),
    database: decodeURIComponent(database.pathname.slice(1)),
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: true, ca },
    connect_timeout: 10,
    idle_timeout: 5,
  });
  const items = await sql.begin("read only", async (tx) => {
    const configuration =
      await tx`select c.project_ref,c.hook_verified_at,c.hook_function_sha256,
      encode(sha256(convert_to(pg_get_functiondef('preview_auth.capture_email(jsonb)'::regprocedure),'UTF8')),'hex') actual_hash
      from preview_auth.configuration c join preview_auth.captured_mail proof on proof.id=c.hook_verified_event_id
      join preview_auth.allowed_recipients a on a.email=proof.email
      where c.singleton and c.enabled and c.project_ref=${projectRef} and c.site_url='http://localhost:3000' and c.expires_at>clock_timestamp()
      and c.hook_verified_at>=c.configured_at and c.hook_verified_at<=clock_timestamp()
      and proof.received_at>=c.configured_at and proof.received_at<=c.hook_verified_at and proof.expires_at>clock_timestamp()
      and a.revoked_at is null and a.expires_at>clock_timestamp()`;
    const c = configuration[0];
    if (
      !c ||
      c.hook_function_sha256 !== c.actual_hash ||
      receipt.hookFunctionSha256 !== c.actual_hash ||
      Date.parse(receipt.hookVerifiedAt) !==
        new Date(c.hook_verified_at).getTime()
    )
      throw new Error("Proof gate");
    const allowed =
      await tx`select email from preview_auth.allowed_recipients where email=any(${addresses}::text[]) and revoked_at is null and expires_at>clock_timestamp()`;
    if (allowed.length !== addresses.length) throw new Error("Allowlist gate");
    return tx`select m.email,m.action as type,m.received_at,m.token_hash,m.redirect_to,m.expires_at from preview_auth.captured_mail m join preview_auth.allowed_recipients a on a.email=m.email where m.email=any(${addresses}::text[]) and m.expires_at>clock_timestamp() and a.revoked_at is null and a.expires_at>clock_timestamp() order by m.received_at,m.id`;
  });
  if (items.some((row) => !/^(pkce_)?[a-f0-9]{40,256}$/.test(row.token_hash)))
    throw new Error("Capture format gate");
  const value = {
    projectRef,
    exportedAt: new Date().toISOString(),
    messages: items.map((row) => ({
      email: row.email,
      type: row.type,
      receivedAt: new Date(row.received_at).toISOString(),
      tokenHash: row.token_hash,
      redirectTo: row.redirect_to,
      expiresAt: new Date(row.expires_at).toISOString(),
    })),
  };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const staging = path.join(directory, "mailbox.pending.json");
  await writeFile(staging, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(staging, path.join(directory, "mailbox.json"));
  console.log(
    `Private mailbox refreshed: ${items.length} unexpired records. No credentials printed.`,
  );
} catch {
  console.error(
    "Private mailbox export failed. Verify preview identity, proof, allowlist and connection privately.",
  );
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 5 });
}
