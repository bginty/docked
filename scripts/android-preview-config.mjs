import { readFileSync } from "node:fs";

export const previewProjectRef = "bckkllmndoxzpzdqrevb";
export const previewApplicationId = "au.com.docked.app.preview";
export const previewManifestPath = "config/android-preview.json";

/** Accept only a recently verified, explicitly isolated public deployment receipt. */
export function validatePreviewManifest(input, now = Date.now()) {
  const fail = () => {
    throw new Error(
      "A current, verified Docked Android preview manifest is required.",
    );
  };
  if (!input || typeof input !== "object" || Array.isArray(input)) fail();
  if (
    input.schemaVersion !== 1 ||
    input.kind !== "docked-android-preview" ||
    input.environment !== "preview" ||
    input.supabaseProjectRef !== previewProjectRef ||
    input.applicationId !== previewApplicationId ||
    typeof input.deploymentId !== "string" ||
    !/^[A-Za-z0-9_-]{6,200}$/.test(input.deploymentId)
  )
    fail();
  let url;
  try {
    url = new URL(input.origin);
  } catch {
    fail();
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== input.origin ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname === "docked.com.au" ||
    url.hostname.endsWith(".docked.com.au")
  )
    fail();
  const verified =
    typeof input.verifiedAt === "string" ? Date.parse(input.verifiedAt) : NaN;
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(verified) ||
    verified > now + 60_000 ||
    now - verified > 86_400_000
  )
    fail();
  const safety = input.safety;
  if (!safety || typeof safety !== "object") fail();
  for (const key of [
    "emailSending",
    "pushSending",
    "billing",
    "competitions",
    "prizes",
    "deals",
    "affiliates",
    "forwardPaper",
    "productionSupabaseAllowed",
  ])
    if (safety[key] !== false) fail();
  if (
    safety.oddsProviderStatus !== "NOT_CONFIGURED" ||
    safety.resultsProviderStatus !== "NOT_CONFIGURED" ||
    safety.strategyStatus !== "UNVALIDATED"
  )
    fail();
  // Whitelist fields: arbitrary receipt extensions or credentials never reach assets.
  return Object.freeze({
    schemaVersion: 1,
    kind: "docked-android-preview",
    environment: "preview",
    origin: url.origin,
    supabaseProjectRef: previewProjectRef,
    applicationId: previewApplicationId,
    deploymentId: input.deploymentId,
    verifiedAt: input.verifiedAt,
  });
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {(file: string, encoding: "utf8") => string} read
 */
export function resolveAndroidTarget(
  env = process.env,
  read = readFileSync,
  now = Date.now(),
) {
  const mode = env.CAPACITOR_PREVIEW_MODE || "bundled";
  if (!["bundled", "local", "hosted"].includes(mode))
    throw new Error("Unknown Android preview build mode.");
  if (
    env.CAPACITOR_PREVIEW_SERVER &&
    (mode !== "local" ||
      env.CAPACITOR_PREVIEW_SERVER !== "http://localhost:3000")
  )
    throw new Error(
      "An arbitrary Android server origin cannot override the approved preview.",
    );
  const inspect = env.CAPACITOR_PREVIEW_DEBUGGING === "1";
  if (inspect && mode !== "local")
    throw new Error(
      "WebView inspection is available only in the explicit local development mode.",
    );
  let manifest = null;
  if (mode === "hosted") {
    try {
      manifest = validatePreviewManifest(
        JSON.parse(read(previewManifestPath, "utf8")),
        now,
      );
    } catch {
      throw new Error(
        "Hosted Android build refused: config/android-preview.json must contain a current verified deployment manifest.",
      );
    }
  }
  const origin =
    mode === "hosted"
      ? manifest.origin
      : mode === "local"
        ? "http://localhost:3000"
        : null;
  return Object.freeze({
    mode,
    origin,
    entryUrl: origin ? `${origin}/home` : null,
    inspect,
    cleartext: mode === "local",
    webDir: `mobile/generated/${mode}`,
    manifest,
  });
}
