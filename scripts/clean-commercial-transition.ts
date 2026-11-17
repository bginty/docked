/** Separate exact account-transition approval is mandatory. No default writes.
 * Credentials are read from a private file, never command arguments or reports.
 * Run only after the separately approved schema/application package is deployed.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import {
  retireContainedAccount,
  type RetirementAdmin,
} from "../src/core/account-retirement";
import { databaseConnectionOptions } from "../src/server/database-tls";
import {
  communicationAction,
  containWithCommunication,
  validatePriorCommunication,
  validateRetirementApproval,
  type RetirementApproval,
} from "./clean-transition-authority";
const arg = (key: string) => {
  const at = process.argv.indexOf(key);
  assert(at >= 0 && process.argv[at + 1], `Required ${key}`);
  return process.argv[at + 1];
};
const digest = (b: string | Buffer) =>
  createHash("sha256").update(b).digest("hex");
async function main() {
  const action = arg("--action");
  assert(["preflight", "contain", "retire", "complete"].includes(action));
  const packagePath = arg("--package"),
    packageBytes = readFileSync(packagePath),
    pkg = JSON.parse(packageBytes.toString());
  assert.equal(pkg.kind, "clean-commercial-account-transition");
  assert.equal(pkg.project, "pojoymtniryarxxunyvz");
  for (const file of pkg.files) {
    assert(!file.path.includes("..") && !file.path.startsWith("/"));
    assert.equal(
      digest(readFileSync(file.path)),
      file.sha256,
      `Package bytes changed: ${file.path}`,
    );
  }
  const manifest = JSON.parse(readFileSync(arg("--manifest"), "utf8"));
  assert.equal(
    digest(JSON.stringify(manifest)),
    pkg.accountManifestSha256,
    "Exact private account manifest changed",
  );
  const communication = validatePriorCommunication(
    pkg,
    manifest,
    readFileSync(pkg.communicationEvidence.path),
  );
  let approval: RetirementApproval | undefined;
  if (action !== "preflight") {
    approval = JSON.parse(readFileSync(arg("--approval"), "utf8"));
    validateRetirementApproval(approval!, pkg, digest(packageBytes));
  }
  // Verify source through immutable Git objects as well as operator file hashes.
  assert.equal(
    execFileSync("git", ["rev-parse", `${pkg.source}^{commit}`], {
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
    pkg.source,
  );
  assert.equal(
    execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        pkg.source,
        "--",
        "src",
        "config",
        "scripts",
        "supabase/migrations",
        "package.json",
        "package-lock.json",
      ],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    ).trim(),
    "",
    "Working implementation differs from approved source",
  );
  const credentials = JSON.parse(
    readFileSync(arg("--private-credentials"), "utf8"),
  );
  const dbUrl = new URL(credentials.databaseUrl);
  assert.equal(dbUrl.username, "postgres.pojoymtniryarxxunyvz");
  assert.match(
    dbUrl.hostname,
    /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/,
  );
  assert.equal(
    credentials.supabaseUrl,
    "https://pojoymtniryarxxunyvz.supabase.co",
  );
  const sql = postgres(dbUrl.href, {
    max: 1,
    ...databaseConnectionOptions(dbUrl.href),
    onnotice: () => {},
  });
  try {
    const health = await fetch(credentials.supabaseUrl + "/auth/v1/health", {
      headers: { apikey: credentials.publishableKey },
      signal: AbortSignal.timeout(10000),
    });
    assert(health.ok);
    assert.equal(
      (await health.json()).version,
      "v2.198.0",
      "Auth provider version changed; review before irreversible work",
    );
    const [gates] =
      await sql`select not exists(select 1 from private.feature_flags where key='registration'and enabled)
   and not exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) closed`;
    assert.equal(gates.closed, true);
    const identities = await sql`select id from auth.users order by id`;
    assert.deepEqual(
      identities.map((u) => u.id).sort(),
      manifest.map((u: { id: string }) => u.id).sort(),
      "Unreviewed or missing Auth identity; review before continuing",
    );
    const [preflight] =
      await sql`select launch_transition.source_digest() source,(select id from launch_transition.batches) batch,(select count(*)::int from commercial_billing.definitions) definitions,(select sum(issued)from commercial_billing.definitions) issued`;
    if (action === "preflight") {
      writeFileSync(
        arg("--output"),
        JSON.stringify(
          {
            at: new Date().toISOString(),
            packageSha256: digest(packageBytes),
            ...preflight,
          },
          null,
          2,
        ) + "\n",
        { mode: 0o600 },
      );
      console.log(
        JSON.stringify({
          preflight: true,
          productionWrites: 0,
          definitions: preflight.definitions,
          issued: preflight.issued,
        }),
      );
      return;
    }
    const reviewed = JSON.parse(readFileSync(arg("--preflight"), "utf8")),
      backup = JSON.parse(readFileSync(arg("--backup-proof"), "utf8"));
    assert(
      Date.now() - Date.parse(reviewed.at) >= 0 &&
        Date.now() - Date.parse(reviewed.at) <= 600000,
      "Fresh preflight <=10 minutes required",
    );
    assert.equal(reviewed.packageSha256, digest(packageBytes));
    assert.equal(backup.sourceProject, pkg.project);
    assert.equal(backup.restored, true);
    assert.equal(backup.protectedRecordsUnchanged, true);
    assert.equal(backup.encryptedAtRest, "AES-256-GCM");
    assert(
      Date.now() - Date.parse(backup.backupAt) >= 0 &&
        Date.now() - Date.parse(backup.backupAt) <= 3600000,
      "Verified encrypted backup <=1 hour required",
    );
    if (action === "contain") {
      const batch = await sql.begin(async (tx) => {
        validateRetirementApproval(approval!, pkg, digest(packageBytes));
        await tx`set local lock_timeout='5s'`;
        await tx`set local statement_timeout='120s'`;
        // The existing notice_sha256 remains a content reference, not delivery proof.
        // Bind honest communication evidence atomically to containment. No new DDL.
        return containWithCommunication(
          tx,
          manifest,
          reviewed.source,
          digest(packageBytes),
          pkg.noticeSha256,
          communication,
        );
      });
      console.log(
        JSON.stringify({
          contained: true,
          batch,
          authCalls: 0,
          publicLaunch: false,
        }),
      );
      return;
    }
    assert(preflight.batch, "Committed containment required");
    const [batchProof] =
      await sql`select approval_sha256,notice_sha256 from launch_transition.batches where id=${preflight.batch}`;
    assert.equal(
      batchProof.approval_sha256,
      digest(packageBytes),
      "Different account package contained",
    );
    assert.equal(batchProof.notice_sha256, pkg.noticeSha256);
    const communicationEvents =
      await sql`select detail from launch_transition.events where batch=${preflight.batch} and action=${communicationAction}`;
    assert.equal(
      communicationEvents.length,
      1,
      "Attested communication checkpoint required",
    );
    assert.deepEqual(
      communicationEvents[0].detail,
      communication,
      "Communication checkpoint drift",
    );
    // Retirement is a forward-only phase. Do not require old source digest after
    // a successful soft deletion; re-validate each exact identity and checkpoint.
    if (action === "complete") {
      validateRetirementApproval(approval!, pkg, digest(packageBytes));
      await sql`select launch_transition.complete(${preflight.batch})`;
      console.log(JSON.stringify({ complete: true, gatesRemainClosed: true }));
      return;
    }
    const admin = createClient(credentials.supabaseUrl, credentials.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
      },
    }).auth.admin;
    const accounts =
      await sql`select user_id,kind,phase,identity_sha256 from launch_transition.accounts where batch=${preflight.batch} order by user_id`;
    for (const a of accounts.filter((a) => a.kind === "customer")) {
      assert(
        approval && Date.now() < Date.parse(approval.expiresAt),
        "Approval expired before Auth boundary",
      );
      assert(
        manifest.some(
          (m: { id: string; kind: string; emailSha256: string }) =>
            m.id === a.user_id &&
            m.kind === a.kind &&
            m.emailSha256 === a.identity_sha256,
        ),
      );
      const lockKey = `clean-retire:${a.user_id}`;
      const [lock] =
        await sql`select pg_try_advisory_lock(hashtextextended(${lockKey},0)) held`;
      assert.equal(
        lock.held,
        true,
        "Another retirement operator is active; do not duplicate it",
      );
      try {
        await retireContainedAccount({
          checkpoint: {
            userId: a.user_id,
            kind: a.kind,
            phase: a.phase,
            emailSha256: a.identity_sha256,
          },
          admin: admin as unknown as RetirementAdmin,
          recordAttempt: async () => {
            assert(
              approval && Date.now() < Date.parse(approval.expiresAt),
              "Approval expired before irreversible action",
            );
            await sql`insert into launch_transition.events(batch,user_id,action)values(${preflight.batch},${a.user_id},'AUTH_SOFT_DELETE_ATTEMPT')`;
          },
          verifyAndRecord: async () => {
            await sql`select launch_transition.record_auth_retired(${preflight.batch},${a.user_id}::uuid)`;
          },
        });
      } finally {
        await sql`select pg_advisory_unlock(hashtextextended(${lockKey},0))`;
      }
      console.log(
        JSON.stringify({
          retiredRef: a.user_id.slice(0, 8) + "…",
          historyPreserved: true,
        }),
      );
    }
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    "Transition stopped. If containment has begun, leave it in place and inspect the private checkpoint/provider result. Never restore access or hard-delete to force completion.",
  );
  process.exitCode = 1;
});
