// Operator-only response to the confirmed pre-hydration form fallback defect.
// Changes only the exact disposable QA A/B passwords and their Auth sessions.
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { db } from "../../src/server/db";
import { previewDatabaseBound } from "../../src/core/preview-auth";

const project = "bckkllmndoxzpzdqrevb";
const fixturePath = "private-data/android-preview/acceptance.json";
const journalPath = "private-data/android-preview/provision-acceptance-state.json";
const durablePath = "private-data/android-preview/tester-credentials.txt";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
async function main() {
  let sql: ReturnType<typeof db> | undefined;
  try {
    if (process.argv.length !== 3 || process.argv[2] !== `--confirm-project=${project}`)
      throw Error("EXACT_PROJECT_CONFIRMATION_REQUIRED");
    const connection = JSON.parse(await readFile("private-data/hosted-preview/connection.json", "utf8"));
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    if (connection.projectRef !== project || connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
        connection.supabaseUrl !== `https://${project}.supabase.co` ||
        process.env.DATABASE_URL !== connection.databaseUrl ||
        process.env.NEXT_PUBLIC_SUPABASE_URL !== connection.supabaseUrl ||
        process.env.SUPABASE_SECRET_KEY !== connection.secretKey || !connection.secretKey ||
        process.env.APP_ENV !== "preview" || process.env.SUPABASE_ENV !== "preview" ||
        !previewDatabaseBound(process.env) || fixture.projectRef !== project || fixture.qaFixture !== true ||
        fixture.memberB?.disposable !== true || journal.projectRef !== project ||
        journal.mode !== "--provision-acceptance" || !Array.isArray(journal.entries) || journal.entries.length !== 2 ||
        journal.state === "password-rotation-pending")
      throw Error("EXACT_PREVIEW_SCOPE_REQUIRED");
    const targets = [fixture.memberA, fixture.memberB];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target || !/^[0-9a-f-]{36}$/i.test(target.id) ||
          target.email !== `docked-preview-s24-qa-${i === 0 ? "a" : "b"}-20261003@example.invalid` ||
          !journal.entries.some((e: { id: string; email: string }) => e.id === target.id && e.email === target.email))
        throw Error("EXACT_DISPOSABLE_ROSTER_REQUIRED");
    }
    if (targets[0].id === targets[1].id) throw Error("DISTINCT_QA_REQUIRED");
    sql = db();
    const closed = (await sql`select
      (select count(*)::int from preview_auth.configuration where enabled) capture_enabled,
      (select count(*)::int from preview_auth.captured_mail) captured_mail,
      (select count(*)::int from private.feature_flags where enabled) enabled_flags`)[0];
    if (closed.capture_enabled !== 0 || closed.captured_mail !== 0 || closed.enabled_flags !== 0)
      throw Error("CLOSED_PREVIEW_REQUIRED");
    const durableFingerprint = async () => sha(JSON.stringify((await sql!`select to_jsonb(u) auth,
      to_jsonb(p) profile,(select jsonb_agg(to_jsonb(c) order by c.id) from private.consent_events c where c.user_id=p.id) consents,
      (select to_jsonb(n) from public.notification_preferences n where n.user_id=p.id) preferences,
      (select jsonb_agg(to_jsonb(g) order by g.id) from private.preview_tester_access g where g.user_id=p.id) grants
      from auth.users u join public.profiles p on p.id=u.id where u.email='docked-preview-s24-tester-20261003@example.invalid'`)[0] ?? null));
    const durable = (await sql`select id from auth.users where email='docked-preview-s24-tester-20261003@example.invalid'`)[0];
    if (!durable || targets.some((t) => t.id === durable.id)) throw Error("DURABLE_BOUNDARY_REQUIRED");
    const before = await durableFingerprint();
    const credentialBefore = sha(await readFile(durablePath));
    const oldHashes: string[] = [];
    for (const target of targets) {
      const rows = await sql`select id,email,encrypted_password from auth.users where id=${target.id} or email=${target.email}`;
      if (rows.length !== 1 || rows[0].id !== target.id || rows[0].email !== target.email)
        throw Error("ACTUAL_ROSTER_MISMATCH");
      oldHashes.push(String(rows[0].encrypted_password));
    }
    const admin = createClient(connection.supabaseUrl, connection.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const rotated = targets.map((target) => ({ ...target, password: randomBytes(32).toString("base64url") + "Aa1!" }));
    const rotatedAt = new Date().toISOString();
    // Persist the replacement secrets only in the existing ignored recovery journal
    // before the first remote update. Partial outcomes must be reviewed, not retried blindly.
    await writeFile(journalPath, JSON.stringify({ ...journal, state: "password-rotation-pending", entries: rotated, passwordRotatedAt: rotatedAt }, null, 2) + "\n", { mode: 0o600 });
    for (const target of rotated) {
      const result = await admin.auth.admin.updateUserById(target.id, { password: target.password });
      if (result.error || result.data.user?.id !== target.id || result.data.user.email !== target.email)
        throw Error("AUTH_ROTATION_REQUIRES_PRIVATE_JOURNAL_REVIEW");
    }
    const ids = targets.map((t) => t.id);
    await sql.begin(async (tx) => {
      // Explicit UUID scope; refresh tokens and live session records are revoked.
      // Already issued JWTs are rejected by Docked's active_member_session check.
      await tx`delete from auth.refresh_tokens where user_id=any(${ids}::text[])`;
      await tx`delete from auth.sessions where user_id=any(${ids}::uuid[])`;
    });
    for (let i = 0; i < targets.length; i++) {
      const row = (await sql`select encrypted_password<>${oldHashes[i]} hash_changed from auth.users where id=${targets[i].id}`)[0];
      if (row?.hash_changed !== true) throw Error("PASSWORD_ROTATION_UNVERIFIED");
    }
    const remaining = (await sql`select
      (select count(*)::int from auth.sessions where user_id=any(${ids}::uuid[])) sessions,
      (select count(*)::int from auth.refresh_tokens where user_id=any(${ids}::text[])) refresh_tokens,
      (select count(*)::int from preview_auth.captured_mail) captured_mail`)[0];
    if (remaining.sessions !== 0 || remaining.refresh_tokens !== 0 || remaining.captured_mail !== 0 || before !== await durableFingerprint() ||
        credentialBefore !== sha(await readFile(durablePath))) throw Error("ROTATION_BOUNDARY_UNVERIFIED");
    await writeFile(fixturePath, JSON.stringify({ ...fixture, memberA: rotated[0], memberB: rotated[1], passwordRotatedAt: rotatedAt }, null, 2) + "\n", { mode: 0o600 });
    await writeFile(journalPath, JSON.stringify({ ...journal, state: "password-rotated-sessions-revoked", entries: rotated, passwordRotatedAt: rotatedAt }, null, 2) + "\n", { mode: 0o600 });
    await writeFile("docs/qa/android-https-preview/qa-password-rotation.json", JSON.stringify({
      projectRef: project, recordedAt: new Date().toISOString(), accountsRotated: 2, remainingQaSessions: remaining.sessions,
      remainingQaRefreshTokens: remaining.refresh_tokens, durableAuthProfileConsentPreferencesGrantAndCredentialsUnchanged: true,
      accountsDeleted: 0, emailSent: false,
      reason: "Precaution after confirmed native GET form fallback. Actual credential exposure was not established; exact disposable passwords rotated and sessions revoked.",
    }, null, 2) + "\n");
    console.log("Two exact disposable QA passwords rotated; all their sessions revoked. Private fixtures updated; durable tester unchanged. No email sent.");
  } catch {
    console.error("QA rotation not verified complete. Review the existing private journal before retrying; no credentials or identities emitted.");
    process.exitCode = 1;
  } finally { if (sql) await sql.end({ timeout: 5 }); }
}
void main();
