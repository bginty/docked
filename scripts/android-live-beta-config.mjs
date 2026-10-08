import { readFileSync } from "node:fs";

export async function verifyCurrentBetaHost(manifest, fetcher = fetch) {
  const response = await fetcher(
    "https://docked.com.au/api/beta-release?check=" + Date.now(),
    {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (
    !response.ok ||
    !response.headers.get("cache-control")?.includes("no-store")
  )
    throw Error("Live release probe unavailable.");
  const body = await response.text();
  if (body.length > 4096) throw Error("Unexpected release response.");
  const current = JSON.parse(body);
  if (
    current.channel !== "beta" ||
    current.origin !== manifest.origin ||
    current.projectRef !== manifest.supabaseProjectRef ||
    current.siteId !== manifest.netlifySiteId ||
    current.commit !== manifest.commit ||
    current.deploymentId !== manifest.deploymentId ||
    current.publicRegistration !== false ||
    current.invitedAuthentication !== true
  )
    throw Error(
      "The current live deployment does not match the accepted beta receipt.",
    );
}

// The receipt records actual hosted acceptance, never a fixture or holding page.
export function validateLiveBetaManifest(input, now = Date.now()) {
  const fail = () => {
    throw Error(
      "Live beta APK requires current, successful hosted acceptance at docked.com.au.",
    );
  };
  if (
    !input ||
    input.schemaVersion !== 1 ||
    input.kind !== "docked-android-live-beta" ||
    input.environment !== "production-beta" ||
    input.origin !== "https://docked.com.au" ||
    input.applicationId !== "au.com.docked.app.beta" ||
    input.supabaseProjectRef !== "pojoymtniryarxxunyvz" ||
    input.netlifySiteId !== "2292ba6e-7073-4804-b69a-26b41c9a9fb1" ||
    !/^[a-f0-9]{24}$/.test(input.deploymentId ?? "") ||
    !/^[a-f0-9]{40}$/.test(input.commit ?? "")
  )
    fail();
  const verified = Date.parse(input.verifiedAt);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(verified) ||
    verified > now + 60_000 ||
    now - verified > 86_400_000
  )
    fail();
  for (const key of [
    "https",
    "invitedAuthentication",
    "emailRecovery",
    "gameplay",
    "rls",
    "policy",
    "betaRecordIsolation",
    "administratorMfa",
  ])
    if (input.acceptance?.[key] !== true) fail();
  for (const key of [
    "publicRegistration",
    "payments",
    "marketplace",
    "officialBettingPublication",
  ])
    if (input.safety?.[key] !== false) fail();
  return Object.freeze({
    schemaVersion: 1,
    kind: input.kind,
    environment: input.environment,
    origin: input.origin,
    applicationId: input.applicationId,
    supabaseProjectRef: input.supabaseProjectRef,
    netlifySiteId: input.netlifySiteId,
    deploymentId: input.deploymentId,
    commit: input.commit,
    verifiedAt: input.verifiedAt,
  });
}
export function resolveLiveBetaTarget(
  env,
  read = readFileSync,
  now = Date.now(),
) {
  if (
    env.CAPACITOR_LIVE_BETA !== "true" ||
    env.CAPACITOR_PREVIEW_SERVER ||
    env.CAPACITOR_PREVIEW_DEBUGGING ||
    ![undefined, "bundled"].includes(env.CAPACITOR_PREVIEW_MODE)
  )
    throw Error(
      "Live beta cannot use Preview, local attachment or inspection overrides.",
    );
  const manifest = validateLiveBetaManifest(
    JSON.parse(read("config/android-live-beta.json", "utf8")),
    now,
  );
  return Object.freeze({
    mode: "beta",
    origin: manifest.origin,
    entryUrl: manifest.origin + "/app",
    inspect: false,
    cleartext: false,
    webDir: "mobile/generated/beta",
    manifest,
  });
}
