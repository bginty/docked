// Owner-authorised revocation of the single obsolete v20 delivery capability.
// Retains the APK privately at a new path; does not change application/member data.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
assert.equal(process.argv[2], "--revoke-v20");
const note = await readFile(
  "artifacts/android/Docked-v20-Samsung-install.txt",
  "utf8",
);
const link = note.match(
  /https:\/\/pojoymtniryarxxunyvz\.supabase\.co\/storage\/v1\/object\/sign\/[^\s]+/,
)?.[0];
assert.ok(link);
const url = new URL(link);
const token = url.searchParams.get("token");
assert.ok(token);
const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
const bucket = "owner-qa-delivery";
assert.ok(claims.url.startsWith(bucket + "/friends/"));
const source = claims.url.slice(bucket.length + 1);
assert.match(source, /\/Docked-v20-NFL-Friends-Beta\.apk$/);
const digest = createHash("sha256").update(token).digest("hex");
const destination = `revoked-v20/${digest}/Docked-v20-NFL-Friends-Beta.apk`;
const c = JSON.parse(
  await readFile("private-data/production/connection.json", "utf8"),
);
const client = createClient(
  "https://pojoymtniryarxxunyvz.supabase.co",
  c.secretKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
try {
  const bucketInfo = await client.storage.getBucket(bucket);
  assert.ifError(bucketInfo.error);
  assert.equal(bucketInfo.data.public, false);
  const old = await client.storage.from(bucket).info(source);
  let result = "already-relocated";
  if (!old.error) {
    const moved = await client.storage.from(bucket).move(source, destination);
    assert.ifError(moved.error);
    result = "relocated";
  }
  const [after, retained] = await Promise.all([
    client.storage.from(bucket).info(source),
    client.storage.from(bucket).info(destination),
  ]);
  assert.ok(after.error, "Old capability path must no longer exist");
  assert.ifError(retained.error);
  const receipt = {
    at: new Date().toISOString(),
    scope: "Single obsolete v20 delivery artifact only",
    result,
    oldPathAbsent: true,
    apkRetainedPrivately: true,
    capabilityUsed: false,
    capabilitySha256: digest,
    applicationAndMemberDataChanged: false,
  };
  await writeFile(
    "docs/qa/social-visual-preview/apk-capability-revocation.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
} catch {
  console.error(
    "Revocation not confirmed; inspect private storage status. No token or API error body emitted.",
  );
  process.exitCode = 1;
}
