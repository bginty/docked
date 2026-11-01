// Nominated reviewer only. Normal signup, email verification and consent remain required.
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
async function main() {
  const root = process.cwd();
  const directory = resolve("private-data/play-reviewer");
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, "invitation.private.json");
  const email = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8")).email
    : process.env.DOCKED_PLAY_REVIEWER_EMAIL;
  assert(
    typeof email === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      email === email.toLowerCase(),
    "Explicit nominated email required",
  );
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  try {
    const result = await sql.begin(async (tx) => {
      await tx`set local lock_timeout='5s'`;
      await tx`select pg_advisory_xact_lock(71820341)`;
      const [account] =
        await tx`select id,email_confirmed_at is not null confirmed from auth.users where lower(email)=${email}`;
      if (account)
        return {
          accountExists: true,
          emailConfirmed: account.confirmed,
          created: false,
        };
      const [prior] =
        await tx`select token_digest,expires_at,revoked_at from beta_private.customer_invitations where email=${email}`;
      if (prior) {
        assert(
          existsSync(path),
          "Existing invitation requires operator recovery; do not replace it",
        );
        const saved = JSON.parse(readFileSync(path, "utf8"));
        assert.equal(
          createHash("sha256").update(saved.token).digest("hex"),
          prior.token_digest,
        );
        assert(
          !prior.revoked_at &&
            new Date(prior.expires_at).getTime() > Date.now(),
        );
        return {
          accountExists: false,
          created: false,
          invitationReady: true,
          expiresAt: prior.expires_at,
        };
      }
      const token = randomBytes(32).toString("hex");
      const [invite] =
        await tx`insert into beta_private.customer_invitations(email,token_digest,expires_at,authority)
      values(${email},${createHash("sha256").update(token).digest("hex")},clock_timestamp()+interval '6 days',
      'Owner-nominated dedicated Google Play reviewer; normal email confirmation, consent and member security required; no administrative or payment permission')
      returning expires_at`;
      writeFileSync(
        path,
        JSON.stringify({
          email,
          token,
          url: `https://docked.com.au/app/signup#invite=${token}`,
          expiresAt: invite.expires_at,
        }),
        { flag: "wx", mode: 0o600 },
      );
      return {
        accountExists: false,
        created: true,
        invitationReady: true,
        expiresAt: invite.expires_at,
      };
    });
    writeFileSync(
      resolve(
        root,
        "docs/qa/customer-billing-20261101/reviewer-preparation.json",
      ),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          ...result,
          normalConfirmationRequired: true,
          passwordCreated: false,
          emailSent: false,
          walletOrInventoryIssued: false,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 2 });
  }
}
void main().catch(() => {
  console.error(
    "Reviewer invitation not confirmed; inspect invitation state before retry",
  );
  process.exitCode = 1;
});
