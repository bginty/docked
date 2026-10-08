import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repository = process.cwd();
const manifest = {
  schemaVersion: 1,
  approved: true,
  origin: "https://docked.com.au",
  projectName: "docked-production",
  vercelProjectId: "prj_FictionalProductionTest",
  vercelTeamId: "team_FictionalProductionTest",
  supabaseProjectRef: "abcdefghijklmnopqrst",
  supabaseOrganizationId: "ernfnkcbalhyqpsrzdwa",
  supabaseRegion: "ap-southeast-2",
  databaseRole: "docked_app",
};

async function fixture(run: (directory: string) => Promise<void>) {
  const base = resolve(tmpdir());
  const directory = await mkdtemp(join(base, "docked-release-test-"));
  try {
    for (const file of [
      "scripts/prepare-production-environment.mjs",
      "scripts/prepare-hosted-preview.mjs",
      "src/core/hosted-production.mjs",
      "src/core/hosting-identity.mjs",
      "config/netlify-build.json",
    ]) {
      await mkdir(dirname(join(directory, file)), { recursive: true });
      await copyFile(join(repository, file), join(directory, file));
    }
    await mkdir(join(directory, "config"), { recursive: true });
    await writeFile(
      join(directory, "config/hosted-production.json"),
      JSON.stringify(manifest),
    );
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: directory, stdio: "pipe" });
    git("init", "--initial-branch=codex/docked-value-platform");
    git(
      "-c",
      "user.name=Release fixture",
      "-c",
      "user.email=release@example.invalid",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--allow-empty",
      "-m",
      "Isolated test fixture",
    );
    await run(directory);
  } finally {
    assert.ok(resolve(directory).startsWith(base + sep));
    assert.ok(directory.includes("docked-release-test-"));
    await rm(directory, { recursive: true, force: true });
  }
}
function execute(directory: string, script: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
    timeout: 20000,
  });
}

test("production environment preparation keeps credentials private and all initial activation closed", async () => {
  await fixture(async (directory) => {
    const secret = "sb_secret_" + "synthetic".repeat(4);
    const databasePassword = "fixture-" + "password";
    await mkdir(join(directory, "private-data/production"), {
      recursive: true,
    });
    await writeFile(
      join(directory, "private-data/production/connection.json"),
      JSON.stringify({
        projectRef: manifest.supabaseProjectRef,
        organizationId: manifest.supabaseOrganizationId,
        supabaseUrl: `https://${manifest.supabaseProjectRef}.supabase.co`,
        publishableKey: "sb_publishable_synthetic",
        secretKey: secret,
        databaseUrl: `postgres://docked_app.${manifest.supabaseProjectRef}:${databasePassword}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
      }),
    );
    await writeFile(
      join(directory, "private-data/production/operator.json"),
      JSON.stringify({
        detailsVerified: true,
        policyReviewApproved: true,
        legalName: "Fictional test operator",
        abn: "00000000000",
        supportEmail: "support@example.invalid",
        termsVersion: "2026-10-v1",
        privacyVersion: "2026-10-v1",
      }),
    );
    const result = execute(
      directory,
      "scripts/prepare-production-environment.mjs",
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes(secret));
    assert.ok(!result.stdout.includes(databasePassword));
    const payload: {
      key: string;
      value: string;
      target: string[];
      type: string;
    }[] = JSON.parse(
      await readFile(
        join(
          directory,
          "private-data/production-deploy/environment-payload.json",
        ),
        "utf8",
      ),
    );
    assert.ok(
      payload.every(
        (value) =>
          value.target.length === 1 && value.target[0] === "production",
      ),
    );
    assert.equal(
      payload.find((value) => value.key === "SUPABASE_SECRET_KEY")?.type,
      "sensitive",
    );
    assert.equal(
      payload.find((value) => value.key === "DATABASE_URL")?.type,
      "sensitive",
    );
    for (const key of [
      "AUTH_EMAIL_ENABLED",
      "REGISTRATION_ENABLED",
      "SENDING_ENABLED",
      "PUBLICATION_ENABLED",
      "MARKET_DATA_POLLING_ENABLED",
      "EDGE_SCANNER_ENABLED",
    ])
      assert.equal(payload.find((value) => value.key === key)?.value, "false");
    assert.ok(!payload.some((value) => value.key.startsWith("VERCEL_")));
    assert.ok(!payload.some((value) => value.key === "THE_ODDS_API_KEY"));
    const denied = execute(
      directory,
      "scripts/prepare-production-environment.mjs",
      "--free-play",
    );
    assert.notEqual(denied.status, 0);
    const operatorPath = join(
      directory,
      "private-data/production/operator.json",
    );
    const operator = JSON.parse(await readFile(operatorPath, "utf8"));
    const ready = {
      ...operator,
      authEmailVerified: true,
      emailVerificationRequired: true,
      productionSmokeTestsPassed: true,
      productionRlsVerified: true,
      freePlayPolicyApproved: true,
      communityPolicyApproved: true,
      concurrencyTestsPassed: true,
      productionProjectRef: manifest.supabaseProjectRef,
    };
    await writeFile(operatorPath, JSON.stringify(ready));
    const allowed = execute(
      directory,
      "scripts/prepare-production-environment.mjs",
      "--free-play",
    );
    assert.equal(allowed.status, 0, allowed.stderr);
    const active = JSON.parse(
      await readFile(
        join(
          directory,
          "private-data/production-deploy/environment-payload.json",
        ),
        "utf8",
      ),
    ) as { key: string; value: string }[];
    for (const key of [
      "REGISTRATION_ENABLED",
      "AUTH_EMAIL_ENABLED",
      "FANTASY_FREE_PLAY_PRODUCTION",
    ])
      assert.equal(active.find((v) => v.key === key)?.value, "true");
    for (const key of [
      "FANTASY_CARDS_PREVIEW",
      "SENDING_ENABLED",
      "PAID_PLANS_ENABLED",
      "PRIZES_ENABLED",
    ])
      assert.equal(active.find((v) => v.key === key)?.value, "false");
    await writeFile(
      operatorPath,
      JSON.stringify({
        ...ready,
        productionProjectRef: "bckkllmndoxzpzdqrevb",
      }),
    );
    assert.notEqual(
      execute(
        directory,
        "scripts/prepare-production-environment.mjs",
        "--free-play",
      ).status,
      0,
    );
    const siteId = "11111111-2222-4333-8444-555555555555";
    const stagingOrigin = "https://docked-authored-stage.netlify.app";
    await writeFile(
      join(directory, "config/hosted-production.json"),
      JSON.stringify({
        ...manifest,
        hostingProvider: "netlify",
        netlifySiteId: siteId,
        netlifyAccountId: "authored_account",
        stagingOrigin,
      }),
    );
    await writeFile(
      operatorPath,
      JSON.stringify({ ...ready, productionSmokeTestsPassed: false }),
    );
    assert.notEqual(
      execute(
        directory,
        "scripts/prepare-production-environment.mjs",
        "--free-play",
        "--staging",
      ).status,
      0,
    );
    await writeFile(
      operatorPath,
      JSON.stringify({
        ...ready,
        productionSmokeTestsPassed: false,
        stagingAccessVerified: true,
      }),
    );
    const staged = execute(
      directory,
      "scripts/prepare-production-environment.mjs",
      "--free-play",
      "--staging",
    );
    assert.equal(staged.status, 0, staged.stderr);
    assert.ok(!staged.stdout.includes(secret));
    const netlify = JSON.parse(
      await readFile(
        join(
          directory,
          "private-data/production-deploy/netlify-environment.json",
        ),
        "utf8",
      ),
    );
    assert.equal(netlify.siteId, siteId);
    assert.equal(netlify.context, "production");
    assert.equal(netlify.values.SITE_URL, stagingOrigin);
    assert.equal(netlify.values.DOCKED_PRODUCTION_STAGE, "staging");
    assert.equal(netlify.values.REGISTRATION_ENABLED, "true");
    assert.equal(netlify.values.PAID_PLANS_ENABLED, "false");
    assert.ok(
      !Object.keys(netlify.values).some((key) =>
        /^(VERCEL|COMMIT_REF|SITE_ID|ACCOUNT_ID|DEPLOY_ID)$/.test(key),
      ),
    );
    // Staging evidence never grants live promotion while public smoke tests remain false.
    assert.notEqual(
      execute(
        directory,
        "scripts/prepare-production-environment.mjs",
        "--free-play",
      ).status,
      0,
    );
  });
});

test("production export requires approved identities and exports only committed deployable sources", async () => {
  await fixture(async (directory) => {
    const explicit = [
      "package.json",
      "package-lock.json",
      "next.config.ts",
      "next-env.d.ts",
      "tsconfig.json",
      "vercel.json",
      "netlify.toml",
      ".vercelignore",
      "certs/supabase-prod-ca-2021.crt",
      "scripts/guard-hosted-build.mjs",
      "config/hosted-preview.json",
      "config/football-v1-research-policy.json",
      "public/brand.txt",
    ];
    for (const file of explicit) {
      await mkdir(dirname(join(directory, file)), { recursive: true });
      await writeFile(
        join(directory, file),
        file.endsWith(".json") ? "{}" : "test fixture",
      );
    }
    await writeFile(
      join(directory, ".env.local"),
      "PRIVATE_TEST_VALUE=must-not-export",
    );
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: directory, stdio: "pipe" });
    git("add", ".");
    git(
      "-c",
      "user.name=Release fixture",
      "-c",
      "user.email=release@example.invalid",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Committed export fixture",
    );
    const result = execute(
      directory,
      "scripts/prepare-hosted-preview.mjs",
      "--production",
    );
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.target, "production");
    const exportManifest = JSON.parse(
      await readFile(
        join(dirname(summary.sourceDirectory), "source-manifest.json"),
        "utf8",
      ),
    );
    const paths = exportManifest.files.map(
      (value: { file: string }) => value.file,
    );
    assert.ok(paths.includes("config/hosted-production.json"));
    assert.ok(paths.includes("src/core/hosted-production.mjs"));
    assert.ok(paths.includes("config/football-v1-research-policy.json"));
    assert.ok(!paths.includes(".env.local"));
    assert.ok(!paths.includes("scripts/prepare-production-environment.mjs"));
    await writeFile(join(directory, "public/brand.txt"), "unreviewed change");
    assert.notEqual(
      execute(directory, "scripts/prepare-hosted-preview.mjs", "--production")
        .status,
      0,
    );
    await writeFile(
      join(directory, "config/hosted-production.json"),
      JSON.stringify({ ...manifest, approved: false }),
    );
    const blocked = execute(
      directory,
      "scripts/prepare-production-environment.mjs",
    );
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /blocked/);
  });
});

test("production export rejects every unreviewed manifest boundary before preparing any source", async () => {
  await fixture(async (directory) => {
    const invalid = [
      { schemaVersion: undefined },
      { schemaVersion: 2 },
      { approved: false },
      { origin: "https://www.docked.com.au" },
      { projectName: "docked-preview" },
      { vercelProjectId: null },
      { vercelProjectId: "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" },
      { vercelTeamId: null },
      { supabaseProjectRef: "bckkllmndoxzpzdqrevb" },
      { supabaseProjectRef: "dwdjeecjdkkiidoutnme" },
      { supabaseProjectRef: "unreviewed" },
      { supabaseOrganizationId: "unrelated-organisation" },
      { supabaseRegion: "us-east-1" },
      { databaseRole: undefined },
      { databaseRole: "docked_app;set role postgres" },
      ...[
        "postgres",
        "supabase_admin",
        "service_role",
        "authenticator",
        "anon",
        "authenticated",
        "supabase_auth_admin",
        "supabase_storage_admin",
        "supabase_realtime_admin",
        "supabase_replication_admin",
        "dashboard_user",
        "pgbouncer",
      ].map((databaseRole) => ({ databaseRole })),
    ];
    for (const change of invalid) {
      await writeFile(
        join(directory, "config/hosted-production.json"),
        JSON.stringify({ ...manifest, ...change }),
      );
      const result = execute(
        directory,
        "scripts/prepare-hosted-preview.mjs",
        "--production",
      );
      assert.notEqual(result.status, 0, JSON.stringify(change));
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /Production target identity has not been reviewed and approved/,
      );
      // Reject identity before generic dirty-source checks or output creation.
      assert.doesNotMatch(result.stderr, /Commit reviewed web source/);
    }
    await assert.rejects(
      readdir(join(directory, "private-data/production-deploy")),
      { code: "ENOENT" },
    );
  });
});
