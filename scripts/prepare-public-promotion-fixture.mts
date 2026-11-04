/** Exact synthetic email admission for normal signup; never autoconfirms Auth. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
const f = JSON.parse(
  readFileSync(
    "private-data/restored-public-preview/fixture.private.json",
    "utf8",
  ),
);
const a = f.accounts.find((x: { kind: string }) => x.kind === "promotion");
assert.equal(f.projectRef, "bckkllmndoxzpzdqrevb");
assert.match(
  a.email,
  /^docked-preview-public-member-[a-f0-9]+@example\.invalid$/,
);
const c = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(c.projectRef, f.projectRef);
const sql = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
try {
  if (process.argv[2] === "verify-closed") {
    const prior = JSON.parse(
      readFileSync(
        "private-data/restored-public-preview/promotion-gates.private.json",
        "utf8",
      ),
    );
    const report = await sql.begin("read only", async (tx) => {
      const [gate] =
        await tx`select enabled from private.feature_flags where key='registration'`;
      assert.equal(gate.enabled, prior.registration);
      const [guard] =
        await tx`select pg_get_functiondef('beta_fantasy.member_guard()'::regprocedure) definition`;
      assert.equal(guard.definition, prior.memberGuard);
      const [mail] =
        await tx`select revoked_at is not null closed from preview_auth.allowed_recipients where email=${a.email}`;
      assert.equal(mail.closed, true);
      const auth = JSON.parse(
        readFileSync(
          "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/private-preview-release/restored-auth.private.json",
          "utf8",
        ),
      );
      assert.equal(auth.disable_signup, true);
      assert.equal(auth.mailer_autoconfirm, false);
      return {
        at: new Date().toISOString(),
        project: f.projectRef,
        registrationRestored: true,
        authSignupClosed: true,
        autoConfirmation: false,
        exactEmailAdmissionRevoked: true,
        memberGuardRestored: true,
        productionWrites: 0,
        passed: true,
      };
    });
    writeFileSync(
      "docs/qa/public-promotion-20261105/preview-closed.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } else if (process.argv[2] === "close") {
    const prior = JSON.parse(
      readFileSync(
        "private-data/restored-public-preview/promotion-gates.private.json",
        "utf8",
      ),
    );
    await sql.begin(async (tx) => {
      if (prior.memberGuard) await tx.unsafe(prior.memberGuard);
      await tx`update private.feature_flags set enabled=${prior.registration} where key='registration'`;
      await tx`update preview_auth.allowed_recipients set revoked_at=clock_timestamp() where email=${a.email} and revoked_at is null`;
    });
    console.log(
      "Original protected registration gate restored; exact test-mail admission revoked.",
    );
  } else if (process.argv[2] === "gameplay") {
    // The restored Preview retains a three-fixture ceiling. Reserve one extra
    // fixture place only here; Production's mode and all account guards stay unchanged.
    const path =
      "private-data/restored-public-preview/promotion-gates.private.json";
    const prior = JSON.parse(readFileSync(path, "utf8"));
    await sql.begin(async (tx) => {
      const [who] =
        await tx`select id,email_confirmed_at from auth.users where email=${a.email}`;
      assert(who?.email_confirmed_at, "Normal confirmed signup required first");
      const [settings] =
        await tx`select deployment_mode from beta_fantasy.settings`;
      assert.equal(settings.deployment_mode, "preview");
      const [guard] =
        await tx`select pg_get_functiondef('beta_fantasy.member_guard()'::regprocedure) definition`;
      assert.equal(guard.definition.split(">=3").length, 2);
      const [members] =
        await tx`select count(*)::int n from beta_fantasy.members where revoked_at is null and expires_at>clock_timestamp()`;
      assert(members.n >= 3 && members.n < 10);
      prior.memberGuard = guard.definition;
      writeFileSync(path, JSON.stringify(prior), { mode: 0o600 });
      await tx.unsafe(guard.definition.replace(">=3", ">=" + (members.n + 1)));
    });
    console.log(
      "One additional isolated fixture place reserved; authentication, RLS and eligibility unchanged.",
    );
  } else {
    await sql.begin(async (tx) => {
      assert.equal(
        (
          await tx`select count(*)::int n from auth.users where email=${a.email}`
        )[0].n,
        0,
        "Do not modify an existing account",
      );
      await tx`insert into preview_auth.allowed_recipients(email,expires_at) values(${a.email},clock_timestamp()+interval '6 hours') on conflict(email) do update set expires_at=excluded.expires_at where preview_auth.allowed_recipients.revoked_at is null`;
      const [prior] =
        await tx`select enabled registration from private.feature_flags where key='registration'`;
      writeFileSync(
        "private-data/restored-public-preview/promotion-gates.private.json",
        JSON.stringify(prior),
        { mode: 0o600, flag: "wx" },
      );
      await tx`update private.feature_flags set enabled=true where key='registration'`;
    });
    console.log(
      "Synthetic confirmation capture admitted for six hours; no Auth account created or confirmed, no beta allowlist entry, no funds.",
    );
  }
} finally {
  await sql.end();
}
