import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  assertHostedProduction,
  productionDisabledFlags,
} from "../src/core/hosted-production.mjs";

// Local preparation only. Never contacts a cloud service, prints credentials,
// copies Preview credentials. Free-play activation requires separately verified readiness facts.
try {
  const liveBeta = process.argv.includes("--live-beta");
  const freePlay = process.argv.includes("--free-play") || liveBeta;
  const staging = process.argv.includes("--staging");
  if (
    process.argv
      .slice(2)
      .some((arg) => !["--free-play", "--staging", "--live-beta"].includes(arg))
  )
    throw new Error("Unsupported preparation option");
  const manifest = JSON.parse(
    await readFile("config/hosted-production.json", "utf8"),
  );
  if (manifest.approved !== true)
    throw new Error("Production resource identities have not been approved");
  const connection = JSON.parse(
    await readFile("private-data/production/connection.json", "utf8"),
  );
  const operator = JSON.parse(
    await readFile("private-data/production/operator.json", "utf8"),
  );
  if (
    connection.projectRef !== manifest.supabaseProjectRef ||
    connection.organizationId !== manifest.supabaseOrganizationId ||
    manifest.supabaseOrganizationId !== "otldyeunbqabbcjydjpe" ||
    operator.detailsVerified !== true ||
    operator.policyReviewApproved !== true ||
    !operator.legalName?.trim() ||
    !/^\d{11}$/.test((operator.abn ?? "").replace(/\s/g, "")) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operator.supportEmail ?? "") ||
    ![operator.termsVersion, operator.privacyVersion].every(
      (value) =>
        typeof value === "string" &&
        /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/.test(value) &&
        !/(draft|preview|fixture|pending|unapproved|placeholder)/i.test(value),
    )
  )
    throw new Error(
      "Production identity, operator or policy review is incomplete",
    );
  if (operator.supportUrl) {
    const support = new URL(operator.supportUrl);
    if (support.protocol !== "https:" || support.username || support.password)
      throw new Error("Support URL must be public HTTPS");
  }
  if (
    freePlay &&
    (operator.authEmailVerified !== true ||
      operator.emailVerificationRequired !== true ||
      (staging
        ? operator.stagingAccessVerified !== true
        : operator.productionSmokeTestsPassed !== true) ||
      operator.productionRlsVerified !== true ||
      operator.freePlayPolicyApproved !== true ||
      operator.communityPolicyApproved !== true ||
      operator.concurrencyTestsPassed !== true ||
      operator.productionProjectRef !== manifest.supabaseProjectRef)
  )
    throw new Error("Production free-play verification is incomplete");
  if (
    liveBeta &&
    (operator.invitedAuthAcceptancePassed !== true ||
      operator.betaRecordsIsolationVerified !== true ||
      operator.administratorMfaVerified !== true)
  )
    throw new Error("Invited beta verification is incomplete");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const netlify = manifest.hostingProvider === "netlify";
  const env = {
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    DOCKED_HOSTED_PRODUCTION: "true",
    DOCKED_HOSTED_PREVIEW: "false",
    SITE_URL: staging ? manifest.stagingOrigin : manifest.origin,
    DOCKED_PRODUCTION_STAGE: staging ? "staging" : "live",
    DATABASE_RUNTIME: "serverless",
    DATABASE_CONNECTION_MODE: connection.connectionMode ?? "session",
    DATABASE_URL: connection.databaseUrl,
    SUPABASE_SECRET_KEY: connection.secretKey,
    NEXT_PUBLIC_SUPABASE_URL: connection.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: connection.publishableKey,
    ODDS_PROVIDER_STATUS: "NOT_CONFIGURED",
    RESULTS_PROVIDER_STATUS: "NOT_CONFIGURED",
    ODDS_MONTHLY_CREDIT_LIMIT: "0",
    REGISTRATION_ENABLED: freePlay && !liveBeta ? "true" : "false",
    DOCKED_RELEASE_CHANNEL: liveBeta ? "beta" : "stable",
    DOCKED_AUTH_INVITES_READY: liveBeta ? "true" : "false",
    AUTH_EMAIL_ENABLED: freePlay ? "true" : "false",
    FANTASY_FREE_PLAY_PRODUCTION: freePlay ? "true" : "false",
    FANTASY_CARDS_PREVIEW: "false",
    LEGAL_ENTITY_VERIFIED: "true",
    DOCKED_LEGAL_NAME: operator.legalName,
    DOCKED_ABN: operator.abn.replace(/\s/g, ""),
    DOCKED_SUPPORT_EMAIL: operator.supportEmail,
    ...(operator.supportUrl ? { DOCKED_SUPPORT_URL: operator.supportUrl } : {}),
    TERMS_VERSION: operator.termsVersion,
    PRIVACY_POLICY_VERSION: operator.privacyVersion,
    ...Object.fromEntries(productionDisabledFlags.map((key) => [key, "false"])),
  };
  // Simulates the expected platform metadata only for local configuration validation.
  // These system fields are NOT uploaded as user-defined provider environment variables.
  // The actual deployment must independently supply and verify its project and Git SHA.
  assertHostedProduction(
    {
      ...env,
      ...(netlify
        ? {
            NETLIFY: "true",
            CONTEXT: "production",
            SITE_ID: manifest.netlifySiteId,
            ACCOUNT_ID: manifest.netlifyAccountId,
            COMMIT_REF: commit,
            ...(staging ? { URL: manifest.stagingOrigin } : {}),
          }
        : {
            VERCEL: "1",
            VERCEL_ENV: "production",
            VERCEL_PROJECT_ID: manifest.vercelProjectId,
            VERCEL_GIT_COMMIT_SHA: commit,
          }),
    },
    manifest,
    // Authored metadata validates local preparation only. Never uploaded or used as a build record.
    netlify
      ? {
          schemaVersion: 1,
          provider: "netlify",
          siteId: manifest.netlifySiteId,
          accountId: manifest.netlifyAccountId,
          context: "production",
          commit,
          deployId: "0".repeat(24),
        }
      : undefined,
  );
  const variables = Object.entries(env).map(([key, value]) => ({
    key,
    value,
    target: ["production"],
    type: ["DATABASE_URL", "SUPABASE_SECRET_KEY"].includes(key)
      ? "sensitive"
      : "encrypted",
  }));
  await mkdir("private-data/production-deploy", { recursive: true });
  await writeFile(
    netlify
      ? "private-data/production-deploy/netlify-environment.json"
      : "private-data/production-deploy/environment-payload.json",
    // Neutral key/value preparation, not an API request. Apply only to the selected site's production context.
    JSON.stringify(
      netlify
        ? {
            provider: "netlify",
            siteId: manifest.netlifySiteId,
            context: "production",
            values: env,
          }
        : variables,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      hostingProvider: netlify ? "netlify" : "vercel",
      projectId: netlify ? manifest.netlifySiteId : manifest.vercelProjectId,
      target: "production",
      localPreparationOnly: true,
      registrationEnabled: freePlay && !liveBeta,
      liveBeta,
      authEmailEnabled: freePlay,
      keys: variables.map(({ key, type }) => ({ key, type })),
    }),
  );
} catch {
  // JSON/parser/provider errors may contain credential values. Emit no raw exception.
  console.error(
    "Production environment preparation is blocked by missing or invalid reviewed resource, operator or policy configuration. No cloud setting changed and no credential emitted.",
  );
  process.exitCode = 1;
}
