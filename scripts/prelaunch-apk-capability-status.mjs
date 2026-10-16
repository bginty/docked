// Read-only Storage metadata inspection. Never downloads or prints a capability.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
try {
  const note = await readFile(
    "artifacts/android/Docked-v20-Samsung-install.txt",
    "utf8",
  );
  const link = note.match(
    /https:\/\/pojoymtniryarxxunyvz\.supabase\.co\/storage\/v1\/object\/sign\/[^\s]+/,
  )?.[0];
  assert.ok(link);
  const token = new URL(link).searchParams.get("token");
  assert.ok(token);
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
  const digest = createHash("sha256").update(token).digest("hex");
  const prior = JSON.parse(
    await readFile(
      "docs/qa/social-visual-preview/apk-capability-revocation.json",
      "utf8",
    ),
  );
  assert.equal(prior.capabilitySha256, digest);
  const bucket = "owner-qa-delivery";
  assert.ok(claims.url.startsWith(bucket + "/friends/"));
  const source = claims.url.slice(bucket.length + 1);
  assert.match(source, /\/Docked-v20-NFL-Friends-Beta\.apk$/);
  const destination = `revoked-v20/${digest}/Docked-v20-NFL-Friends-Beta.apk`;
  const latest = JSON.parse(
    await readFile("docs/qa/android-v22/apk-published.json", "utf8"),
  );
  assert.equal(latest.bucket, bucket);
  assert.match(
    latest.object,
    /^friends\/[a-f0-9]{64}\/Docked-v22-NFL-Friends-Beta\.apk$/,
  );
  // Storage API credential only, no database connection or migration credential.
  const config = JSON.parse(
    await readFile("private-data/production/connection.json", "utf8"),
  );
  const client = createClient(
    "https://pojoymtniryarxxunyvz.supabase.co",
    config.secretKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, options) =>
          fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
      },
    },
  );
  const bucketResult = await client.storage.getBucket(bucket);
  assert.ifError(bucketResult.error);
  assert.equal(bucketResult.data.public, false);
  const [old, retained, current] = await Promise.all([
    client.storage.from(bucket).info(source),
    client.storage.from(bucket).info(destination),
    client.storage.from(bucket).info(latest.object),
  ]);
  // Do not mistake a network/auth failure for proof the original object is absent.
  const absent =
    old.error &&
    ["404", "NoSuchKey", "not_found"].includes(
      String(old.error.statusCode ?? old.error.code),
    );
  const report = {
    at: new Date().toISOString(),
    readOnly: true,
    capabilityUsed: false,
    priorReceiptMatchesTokenDigest: true,
    privateBucketConfirmed: true,
    signedExpiry: new Date(claims.exp * 1000).toISOString(),
    oldObjectAbsent: Boolean(absent),
    oldLookupStatus: old.error
      ? String(old.error.statusCode ?? old.error.code ?? "unclassified")
      : "present",
    archivePresent: !retained.error,
    replacementV22Present: !current.error,
    priorRelocationAt: prior.at,
    cryptographicRevocationVerified: false,
    note: "Object relocation disables the origin path; token expiry and cache behaviour remain separate. No new mutation performed.",
  };
  await writeFile(
    "docs/qa/prelaunch-data/apk-capability-status.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch {
  console.error(
    "Read-only APK status check incomplete; credentials and response details withheld.",
  );
  process.exitCode = 1;
}
