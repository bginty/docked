// Exact Docked-only, additive test economy. No Auth, beta assets, email or real funds changes.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import {
  initialMemberTestCredits,
  barryGrantReference,
  assertMemberTestEconomy,
} from "../src/core/member-test-wallet";
import { wallet } from "../src/core/credits-sandbox";
async function main() {
  assert.equal(process.argv[2], "--apply");
  assert.equal(
    JSON.parse(
      readFileSync("docs/qa/android-v20/test-wallet-postgres.json", "utf8"),
    ).passed,
    true,
  );
  const recorded = JSON.parse(
    readFileSync("private-data/barry-invitation/eligibility.json", "utf8"),
  );
  assert.equal(recorded.email, "barrydearing@gmail.com");
  assert.equal(recorded.id, "ef641248-67be-4c32-9b12-9205bfcee15b");
  const sql = ownerDatabase();
  let runtime: ReturnType<typeof ownerRuntimeDatabase> | undefined;
  const migration = "20261011100229_financial_test_wallet.sql",
    source = readFileSync(
      "supabase/migrations/" + migration,
      "utf8",
    ).replaceAll("\r\n", "\n"),
    hash = (v: string) => createHash("sha256").update(v).digest("hex");
  try {
    const users =
      await sql`select u.id,u.email,a.status,p.disabled_at,(select role from beta_private.roles where user_id=u.id) role,(select enabled from beta_private.friends_roster where user_id=u.id) roster from auth.users u join beta_public.profiles p on p.id=u.id join beta_private.admissions a on a.user_id=u.id where u.email in (${recorded.email},'support@docked.com.au') and u.email_confirmed_at is not null`;
    const barry = users.filter(
        (u) =>
          u.id === recorded.id &&
          u.email === recorded.email &&
          u.status === "accepted" &&
          !u.disabled_at &&
          u.roster === true &&
          !u.role,
      ),
      owner = users.filter(
        (u) =>
          u.email === "support@docked.com.au" &&
          u.role === "owner" &&
          u.status === "accepted" &&
          !u.disabled_at,
      );
    assert.equal(barry.length, 1);
    assert.equal(owner.length, 1);
    const snapshot = async () =>
      hash(
        JSON.stringify(
          await sql`select (select jsonb_agg(to_jsonb(c) order by c.id) from beta_fantasy.cards c where c.owner_id in (${barry[0].id},${owner[0].id})) cards,(select jsonb_agg(to_jsonb(p) order by p.id) from beta_public.profiles p where p.id in (${barry[0].id},${owner[0].id})) profiles`,
        ),
      );
    const before = await snapshot();
    await sql.begin(async (tx) => {
      const version = migration.slice(0, 14);
      const prior =
        await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
      if (prior.length)
        assert.equal(
          hash(prior[0].statements[0].replaceAll("\r\n", "\n")),
          hash(source),
        );
      else {
        await tx.unsafe(source);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},'financial_test_wallet',${[source]})`;
      }
      const existing =
        await tx`select document from credits_sandbox.state where id`;
      if (!existing.length)
        await tx`insert into credits_sandbox.state values(true,0,${tx.json(initialMemberTestCredits() as any)})`;
      else assertMemberTestEconomy(existing[0].document);
      for (const p of [
        { id: barry[0].id, kind: "tester", label: "Barry" },
        { id: owner[0].id, kind: "owner", label: "Owner" },
      ]) {
        const old =
          await tx`select kind from credits_sandbox.access where user_id=${p.id}::uuid`;
        if (old.length) assert.equal(old[0].kind, p.kind);
        else
          await tx`insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note) values(${p.id},${p.kind},${p.label},true,'Owner authorised Barry existing-account financial testing and one-time 100000 TEST grant, 11 October 2026; no invitations, cash or role changes')`;
      }
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          (
            await tx`select has_table_privilege(${role},'credits_sandbox.state','select') allowed`
          )[0].allowed,
          false,
        );
    });
    const store = new CreditsSandboxStore(sql),
      prior = wallet(await store.read(), barry[0].id);
    const actor = { id: owner[0].id, role: "reviewer", aal: "aal2" } as const; // Explicit owner-authorised operator grant; does not create a login/MFA session.
    const command = {
      kind: "promotion",
      member: barry[0].id,
      amount: 100000,
      campaign: "barry-100000-once-20261011",
      reason:
        "Owner authorisation 11 Oct 2026: exactly 100000 TEST Docked Credits for Barry pack, reveal, sale and swap testing; no cash value, withdrawal or conversion",
      confirmed: true,
      redeemable: false,
    };
    const result = await store.execute(actor, barryGrantReference, command);
    await store.execute(actor, barryGrantReference, command);
    const state = await store.read();
    assertMemberTestEconomy(state);
    assert.equal(
      state.journal.filter((j) => j.id === barryGrantReference + "_issue")
        .length,
      1,
    );
    assert.equal(wallet(state, barry[0].id).withdrawable, 0);
    assert.equal(await snapshot(), before);
    runtime = ownerRuntimeDatabase();
    const runtimeClient = runtime;
    await assert.rejects(
      () =>
        runtimeClient`update credits_sandbox.access set enabled=false where user_id=${barry[0].id}::uuid`,
      /permission/,
    );
    const rs = new CreditsSandboxStore(runtime);
    assertMemberTestEconomy(await rs.read());
    mkdirSync("docs/qa/android-v20", { recursive: true });
    const report = {
      at: new Date().toISOString(),
      projectRef,
      migration,
      sha256: hash(source),
      recipientId: barry[0].id,
      recipientEmail: barry[0].email,
      reference: barryGrantReference,
      amount: 100000,
      result,
      before: prior,
      after: wallet(state, barry[0].id),
      oneGrantVerified: true,
      existingBetaCardsProfilesUnchanged: true,
      runtimeAdmissionWriteDenied: true,
      invitationsSent: 0,
      realPayments: false,
    };
    writeFileSync(
      "docs/qa/android-v20/barry-grant.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await runtime?.end();
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Test grant failed");
  process.exitCode = 1;
});
