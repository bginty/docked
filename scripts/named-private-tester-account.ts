/** Prepared account support operator. Never deploys, grants credits or impersonates a member. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  namedTesterActivationSql,
  namedTesterId,
  namedTesterEmailDigest,
  namedTesterDirectory,
  namedTesterGrantRequest,
} from "./lib/named-tester-plan";
import { wallet } from "../src/core/credits-sandbox";

async function mainRun() {
  const root = process.cwd(),
    main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
  const hash = (v: string | Buffer) =>
    createHash("sha256").update(v).digest("hex");
  const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
  const arg = (key: string) =>
    process.argv.find((a) => a.startsWith(key + "="))?.slice(key.length + 1);
  const apply = process.argv.includes("--apply");
  process.chdir(main);
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const inspect = async () => {
      const [account] =
        await sql`select u.id,u.email,u.email_confirmed_at,u.last_sign_in_at,
   a.status,a.country,a.state,a.age_attested,a.expires_at,
   exists(select 1 from beta_public.profiles p where p.id=u.id) profile_exists,
   exists(select 1 from beta_private.roles r where r.user_id=u.id) has_roles
   from auth.users u join beta_private.admissions a on a.user_id=u.id where u.id=${namedTesterId}::uuid`;
      assert(
        account && hash(account.email.toLowerCase()) === namedTesterEmailDigest,
        "Exact existing account mismatch",
      );
      const [state] =
        await sql`select document from credits_sandbox.state where id`;
      return {
        account,
        spendable: wallet(state.document, namedTesterId).available,
        remainingCampaign:
          Number(state.document.policy.campaignLimit) -
          Number(
            state.document.campaigns["founder-private-beta-credits-20261115"] ??
              0,
          ),
      };
    };
    const initial = await inspect();
    if (!apply) {
      console.log(
        JSON.stringify({
          mode: "read-only",
          existingAccount: true,
          emailConfirmed: !!initial.account.email_confirmed_at,
          admission: initial.account.status,
          profileExists: initial.account.profile_exists,
          spendableCredits: initial.spendable,
          targetCredits: 100000,
          remainingCampaign: initial.remainingCampaign,
          productionWrites: 0,
        }),
      );
    } else {
      assert(
        arg("--approval") && arg("--backup"),
        "Exact founder approval and fresh verified backup receipts required",
      );
      const packagePath = namedTesterDirectory + "deployment-package.json",
        packet = read(packagePath),
        packageSha256 = hash(readFileSync(packagePath)),
        approval = read(arg("--approval")!),
        backup = read(arg("--backup")!);
      assert.equal(approval.sourceCommit, packet.sourceCommit);
      assert.equal(approval.packageSha256, packageSha256);
      assert.equal(
        approval.scope,
        "Brenton-only private tester deployment and account provisioning",
      );
      const age = Date.now() - Date.parse(approval.approvedAt);
      assert(age >= 0 && age <= 24 * 3600e3, "Exact approval expired");
      for (const f of packet.reviewedFiles)
        assert.equal(
          hash(readFileSync(resolve(root, f.file))),
          f.sha256,
          "Reviewed bytes changed: " + f.file,
        );
      assert.equal(backup.sourceProject, "pojoymtniryarxxunyvz");
      assert.equal(backup.restored, true);
      assert.equal(backup.protectedRecordsUnchanged, true);
      assert.equal(backup.encryptedAtRest, "AES-256-GCM");
      const backupAge = Date.now() - Date.parse(backup.backupAt);
      assert(
        backupAge >= 0 && backupAge <= 3600e3,
        "Fresh encrypted backup required",
      );
      const response = await fetch("https://docked.com.au/api/beta-release", {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      assert(response.ok, "Production identity unavailable");
      const live = await response.json();
      assert.equal(live.commit, packet.sourceCommit);
      assert.equal(live.siteId, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
      assert.equal(live.projectRef, "pojoymtniryarxxunyvz");
      assert.equal(live.publicRegistration, false);
      assert.equal(initial.account.status, "reserved");
      assert.equal(initial.account.profile_exists, false);
      assert.equal(initial.account.has_roles, false);
      assert.equal(
        initial.spendable,
        0,
        "Credit baseline changed; prepare a top-up, never blindly add 100,000",
      );
      assert(
        initial.remainingCampaign >= 100000,
        "Remaining campaign cannot cover the requested grant",
      );
      const connection = read(
        join(main, "private-data/production/connection.json"),
      );
      assert.equal(connection.projectRef, "pojoymtniryarxxunyvz");
      const admin = createClient(
        "https://pojoymtniryarxxunyvz.supabase.co",
        connection.secretKey,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: before, error: readError } =
        await admin.auth.admin.getUserById(namedTesterId);
      assert(
        !readError &&
          before.user &&
          hash(before.user.email!.toLowerCase()) === namedTesterEmailDigest,
        "Auth identity mismatch",
      );
      assert(
        !before.user.last_sign_in_at &&
          !before.user.factors?.some((f) => f.status === "verified"),
        "Account now in use; review before resetting credentials",
      );
      const folder = join(
        process.env.USERPROFILE!,
        ".docked-secrets",
        "brenton-private-tester-20261115",
      );
      mkdirSync(folder, { recursive: true });
      const sid = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
        ],
        { windowsHide: true },
      )
        .toString()
        .trim();
      assert.match(sid, /^S-1-5-\d+(?:-\d+)+$/);
      execFileSync(
        "icacls.exe",
        [
          folder,
          "/inheritance:r",
          "/grant:r",
          "*" + sid + ":(OI)(CI)F",
          "*S-1-5-18:(OI)(CI)F",
        ],
        { windowsHide: true, stdio: "pipe" },
      );
      const handoff = join(folder, "private-login.txt"),
        receipt = join(folder, "provisioning-receipt.json");
      assert(
        !existsSync(handoff) && !existsSync(receipt),
        "Existing support handoff found; inspect it, do not generate another password",
      );
      const password = randomBytes(24).toString("base64url");
      writeFileSync(
        handoff,
        `Prepared initial password — NOT ACTIVE until provisioning-receipt.json confirms success.\nEmail: ${before.user.email}\nInitial password: ${password}\nLogin: https://docked.com.au/app/login\nComplete your own California details, age and notices. Change this initial password privately after login. It is not automatically one-time or expiring.\n`,
        { flag: "wx", mode: 0o600 },
      );
      const reference = `Founder approved source ${packet.sourceCommit}; package ${packageSha256}; approved ${approval.approvedAt}`;
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout='3s'`;
        await tx`set local statement_timeout='30s'`;
        await tx.unsafe(namedTesterActivationSql(reference));
      });
      // Any uncertain provider/readback outcome revokes app access before reporting.
      try {
        // Supported Auth admin API, exact existing UUID only; no invitation request.
        const { error: updateError } = await admin.auth.admin.updateUserById(
          namedTesterId,
          {
            password,
            email_confirm: true,
            app_metadata: {
              ...before.user.app_metadata,
              email_ownership_verified: false,
              named_tester_provisioning: {
                source: "founder-authorized support",
                packageSha256,
                at: new Date().toISOString(),
                automatedInboxVerification: false,
              },
            },
          },
        );
        if (updateError) throw Error("Auth update was not confirmed");
        const { data: after, error: afterError } =
          await admin.auth.admin.getUserById(namedTesterId);
        assert(
          !afterError &&
            after.user?.email_confirmed_at &&
            after.user.app_metadata.named_tester_provisioning?.packageSha256 ===
              packageSha256,
          "Auth readback not confirmed; inspect before retry",
        );
        const [access] =
          await sql`select beta_private.named_tester_setup_identity(${namedTesterId}::uuid) setup,beta_private.admitted(${namedTesterId}::uuid) admitted,beta_packs.member_allowed(${namedTesterId}::uuid) packs`;
        assert.deepEqual(
          {
            setup: access.setup,
            admitted: access.admitted,
            packs: access.packs,
          },
          { setup: true, admitted: false, packs: false },
        );
        const verified = await inspect();
        assert.equal(verified.spendable, initial.spendable);
        const result = {
          at: new Date().toISOString(),
          sourceCommit: packet.sourceCommit,
          packageSha256,
          accountPrepared: true,
          initialPasswordProvisioned: true,
          passwordHandoff: handoff,
          automatedInboxVerification: false,
          memberConsentPending: true,
          creditGrantPending: true,
          targetSpendableCredits: 100000,
          grantRequest: namedTesterGrantRequest,
          creditsChanged: 0,
          cardsMinted: 0,
        };
        writeFileSync(receipt, JSON.stringify(result, null, 2) + "\n", {
          flag: "wx",
          mode: 0o600,
        });
        console.log(JSON.stringify(result));
      } catch {
        await sql.begin(async (tx) => {
          await tx`update beta_private.named_tester_exception set enabled=false where user_id=${namedTesterId}::uuid`;
        });
        throw Error(
          "Provisioning not confirmed; named app access revoked. Inspect the saved handoff and Auth state before retrying; never reset again automatically.",
        );
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
mainRun().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
