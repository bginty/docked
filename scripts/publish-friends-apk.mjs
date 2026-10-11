// Upload only the audited, credential-free beta APK; no email/distribution message.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const audit = JSON.parse(
  readFileSync("docs/qa/friends-cutover/apk-audit.json"),
);
const identity = JSON.parse(
  readFileSync("docs/qa/friends-cutover/apk-details.json"),
);
assert.equal(audit.status, "PASS");
assert.equal(identity.status, "PASS");
assert.equal(audit.previewOrigin, "https://docked.com.au");
const bytes = readFileSync(audit.artifact);
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(hash(bytes), audit.sha256);
assert.equal(identity.sha256, audit.sha256);
const c = JSON.parse(readFileSync("private-data/production/connection.json"));
const storage = createClient(
  "https://pojoymtniryarxxunyvz.supabase.co",
  c.secretKey,
  { auth: { persistSession: false } },
).storage;
const bucket = "owner-qa-delivery";
const info = await storage.getBucket(bucket);
assert.ifError(info.error);
assert.equal(info.data.public, false);
const name = `Docked-v${identity.current.versionCode}-NFL-Friends-Beta.apk`;
const object = `friends/${audit.sha256}/${name}`;
const prior = await storage.from(bucket).download(object);
if (prior.data)
  assert.equal(hash(Buffer.from(await prior.data.arrayBuffer())), audit.sha256);
else {
  const upload = await storage
    .from(bucket)
    .upload(object, bytes, {
      contentType: "application/vnd.android.package-archive",
      upsert: false,
    });
  assert.ifError(upload.error);
}
const seconds = 7 * 24 * 60 * 60;
const signed = await storage
  .from(bucket)
  .createSignedUrl(object, seconds, { download: name });
assert.ifError(signed.error);
// No authentication headers: this verifies practical recipient download access.
const response = await fetch(signed.data.signedUrl);
assert.equal(response.status, 200);
assert.equal(hash(Buffer.from(await response.arrayBuffer())), audit.sha256);
const privateReceipt = {
  url: signed.data.signedUrl,
  expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
  sha256: audit.sha256,
};
writeFileSync(
  "private-data/friends-cutover/apk-download.json",
  JSON.stringify(privateReceipt, null, 2) + "\n",
);
const publicReceipt = {
  at: new Date().toISOString(),
  bucket,
  object,
  expiresAt: privateReceipt.expiresAt,
  sha256: audit.sha256,
  bytes: bytes.length,
  downloadWithoutLoginVerified: true,
  invitationSent: false,
};
writeFileSync(
  "docs/qa/friends-cutover/apk-published.json",
  JSON.stringify(publicReceipt, null, 2) + "\n",
);
console.log(JSON.stringify(privateReceipt));
