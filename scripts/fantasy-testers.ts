import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import {
  assertPhase5dConnection,
  phase5dProject,
} from "./hosted-preview/phase5d-scope";
const dir = "private-data/fantasy";
type Tester = {
  name: string;
  email: string;
  password: string;
  id?: string;
  factorId?: string;
  totpSecret?: string;
};
export function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")]
    .map((c) => {
      const n = alphabet.indexOf(c);
      if (n < 0) throw Error("Factor encoding");
      return n.toString(2).padStart(5, "0");
    })
    .join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  return ((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function main() {
  if (
    process.argv[2] !== "provision" ||
    process.argv[3] !== `--confirm-project=${phase5dProject}`
  )
    throw Error("Exact Preview provision scope required");
  await mkdir(dir, { recursive: true });
  const c = JSON.parse(
    await readFile("private-data/hosted-preview/connection.json", "utf8"),
  );
  assertPhase5dConnection(c);
  const sql = postgres(c.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: true, ca: await readFile(c.caFile, "utf8") },
    onnotice: () => {},
  });
  try {
    if (
      !(
        await sql`select 1 from supabase_migrations.schema_migrations where version='20261007204317'`
      ).length
    )
      throw Error("Fantasy migration required");
    const original = (await sql`select id from auth.users order by id`).map(
      (r) => String(r.id),
    );
    let j: { runId: string; baselineIds: string[]; accounts: Tester[] };
    try {
      j = JSON.parse(await readFile(dir + "/testers.json", "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      j = {
        runId: randomUUID(),
        baselineIds: original,
        accounts: ["Briant", "Barry", "Test Manager"].map((name, i) => ({
          name,
          email: `docked-fantasy-${i + 1}-${randomUUID().slice(0, 8)}@example.invalid`,
          password: randomBytes(28).toString("base64url") + "Aa1!",
        })),
      };
      await writeFile(dir + "/testers.json", JSON.stringify(j, null, 2), {
        flag: "wx",
        mode: 0o600,
      });
    }
    const save = () =>
      writeFile(dir + "/testers.json", JSON.stringify(j, null, 2), {
        mode: 0o600,
      });
    const admin = createClient(c.supabaseUrl, c.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const [i, a] of j.accounts.entries()) {
      if (!a.id) {
        const made = await admin.auth.admin.createUser({
          email: a.email,
          password: a.password,
          email_confirm: true,
          app_metadata: {
            qa_fixture: true,
            fantasy_preview_run: j.runId,
            email_ownership_verified: false,
          },
        });
        if (made.error || !made.data.user)
          throw Error("Test account provisioning failed");
        a.id = made.data.user.id;
        await save();
      }
      if (j.baselineIds.includes(a.id))
        throw Error("Protected account overlap");
      const current = await admin.auth.admin.getUserById(a.id);
      if (
        current.error ||
        current.data.user?.app_metadata.fantasy_preview_run !== j.runId
      )
        throw Error("Test identity mismatch");
      await sql.begin(async (tx) => {
        await tx`insert into public.profiles(id,country,state,age_attested,accepted_version,onboarding_completed_at,timezone) values(${a.id!},'XX','DOCKED_PREVIEW',true,'2026-10-draft',clock_timestamp(),'Australia/Sydney') on conflict do nothing`;
        await tx`insert into public.notification_preferences(user_id,paused,digest,edge_alerts,education)values(${a.id!},true,'off',false,false) on conflict do nothing`;
        if (
          !(
            await tx`select 1 from private.consent_events where user_id=${a.id!} and purpose='privacy'`
          ).length
        )
          await tx`insert into private.consent_events(user_id,purpose,granted,version,actor)values(${a.id!},'privacy',true,'2026-10-draft','fantasy-synthetic-preview-fixture')`;
        const s =
          await tx`insert into private.social_profiles(user_id,handle,display_name) values(${a.id!},${"fantasy_" + ["briant", "barry", "manager"][i] + "_" + j.runId.slice(0, 6)},${a.name}) on conflict(user_id) do update set display_name=excluded.display_name returning id`;
        await tx`insert into private.social_notification_preferences(profile_id)values(${s[0].id}) on conflict do nothing`;
        await tx`insert into private.app_onboarding(user_id,interests)values(${a.id!},'community') on conflict do nothing`;
        await tx`insert into fantasy.members(user_id,expires_at)values(${a.id!},clock_timestamp()+interval '7 days') on conflict do nothing`;
        if (i === 2)
          await tx`insert into private.roles(user_id,role)values(${a.id!},'admin') on conflict do nothing`;
        await tx`insert into private.audit_events(actor,action,subject,details)values('fantasy-preview-operator','fantasy_tester_provisioned',${a.id!},${tx.json({ runId: j.runId, synthetic: true, noEmail: true })})`;
      });
    }
    await sql.begin(async (tx) => {
      const existing =
        await tx`select id from private.region_policies where version=${"fantasy-" + j.runId}`;
      const policy = existing.length
        ? existing
        : await tx`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence,preview_community_only)values('XX','DOCKED_PREVIEW',${"fantasy-" + j.runId},clock_timestamp()-interval '1 minute',clock_timestamp()+interval '7 days',clock_timestamp()+interval '7 days',true,18,array['community_social','public_profiles'],${"PREVIEW TEST ONLY: Fantasy Cards three-account fixture " + j.runId},true) returning id`;
      for (const a of j.accounts)
        if (
          !(
            await tx`select 1 from private.preview_tester_access where user_id=${a.id!} and policy_id=${policy[0].id}`
          ).length
        )
          await tx`insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,granted_by,reason)values(${a.id!},${policy[0].id},${phase5dProject},clock_timestamp()+interval '6 days','fantasy-preview-operator','User-authorized three-account Fantasy Cards testing only')`;
      await tx`update fantasy.settings set enabled=true`;
    });
    const manager = j.accounts[2];
    const client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({
      email: manager.email,
      password: manager.password,
    });
    if (login.error) throw Error("Genuine manager login failed");
    if (!manager.factorId) {
      const f = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Fantasy Preview Manager",
      });
      if (f.error || !f.data.totp) throw Error("MFA enrollment failed");
      manager.factorId = f.data.id;
      manager.totpSecret = f.data.totp.secret;
      await save();
    }
    const verified = await client.auth.mfa.challengeAndVerify({
      factorId: manager.factorId,
      code: totp(manager.totpSecret!),
    });
    if (verified.error) throw Error("MFA verification failed");
    await writeFile(
      dir + "/tester-access.txt",
      j.accounts
        .map(
          (a) =>
            `${a.name}\nLogin: ${a.email}\nPassword: ${a.password}${a.factorId ? `\nMFA factor ID: ${a.factorId}\nAuthenticator setup secret: ${a.totpSecret}` : ""}`,
        )
        .join("\n\n") +
        "\n\nIsolated Preview accounts only. Do not publish this file.\n",
      { mode: 0o600 },
    );
    const preserved =
      await sql`select count(*)::int n from auth.users where id=any(${j.baselineIds}::uuid[])`;
    if (preserved[0].n !== j.baselineIds.length)
      throw Error("Protected account changed");
    await mkdir("docs/qa/fantasy", { recursive: true });
    await writeFile(
      "docs/qa/fantasy/testers.json",
      JSON.stringify(
        {
          project: phase5dProject,
          created: 3,
          originalAccountsPreserved: j.baselineIds.length,
          genuineManagerMfa: true,
          emailsSent: 0,
          expiresInDays: 7,
          productionChanged: false,
        },
        null,
        2,
      ),
    );
    console.log(
      "Three Preview testers ready; credentials saved privately; genuine manager MFA verified.",
    );
  } finally {
    await sql.end();
  }
}
if (process.argv[1]?.endsWith("fantasy-testers.ts"))
  main().catch(async (e) => {
    await mkdir(dir, { recursive: true });
    await writeFile(dir + "/tester-error.txt", String(e?.stack ?? e), {
      mode: 0o600,
    });
    console.error("Tester setup failed; private diagnostic retained.");
    process.exitCode = 1;
  });
