/** Two new synthetic Preview accounts only. Never changes an existing account. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const ref = "bckkllmndoxzpzdqrevb";
const path =
  process.env.USERPROFILE + "/.docked-secrets/batch1-hosted-20261116.json";
const reportPath = "docs/qa/batch1-hosted-20261116/auth-acceptance.json";
function otp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((x) => parseInt(x, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", bytes).update(counter).digest();
  const o = h[19] & 15;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function main() {
  assert.equal(process.argv[2], "--synthetic-preview-only");
  const c = JSON.parse(
    readFileSync(
      "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
      "utf8",
    ),
  );
  assert.equal(c.projectRef, ref);
  assert.equal(c.supabaseUrl, `https://${ref}.supabase.co`);
  assert(c.secretKey && c.publishableKey);
  const saved = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : { projectRef: ref, createdAt: new Date().toISOString(), accounts: [] };
  assert.equal(saved.projectRef, ref);
  const save = () =>
    writeFileSync(path, JSON.stringify(saved), { mode: 0o600 });
  const admin = createClient(c.supabaseUrl, c.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  while (saved.accounts.length < 2) {
    const account = {
      email: `docked-batch1-${randomBytes(8).toString("hex")}@example.invalid`,
      password: randomBytes(32).toString("base64url"),
      id: null,
    };
    saved.accounts.push(account);
    save();
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: { docked_acceptance: "batch1-hosted-20261116" },
    });
    if (error) throw Error("Synthetic account creation failed: " + error.code);
    assert(data.user?.id);
    account.id = data.user.id as any;
    save();
  }
  assert.equal(saved.accounts.length, 2);
  for (const account of saved.accounts) {
    assert(
      account.id,
      "Inspect partial provisioning; never automatically duplicate an account",
    );
    assert.match(
      account.email,
      /^docked-batch1-[a-f0-9]{16}@example\.invalid$/,
    );
    const client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (login.error)
      throw Error("Synthetic password login failed: " + login.error.code);
    assert.equal(login.data.user.id, account.id);
    assert.equal(
      login.data.user.app_metadata.docked_acceptance,
      "batch1-hosted-20261116",
    );
    if (!account.factor) {
      const enrolled = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Batch 1 synthetic acceptance",
      });
      if (enrolled.error)
        throw Error("Synthetic TOTP enrolment failed: " + enrolled.error.code);
      account.factor = enrolled.data.id;
      account.totp = enrolled.data.totp.secret;
      save();
    }
    const challenge = await client.auth.mfa.challenge({
      factorId: account.factor,
    });
    if (challenge.error)
      throw Error("Synthetic MFA challenge failed: " + challenge.error.code);
    const verified = await client.auth.mfa.verify({
      factorId: account.factor,
      challengeId: challenge.data.id,
      code: otp(account.totp),
    });
    if (verified.error)
      throw Error("Synthetic MFA verification failed: " + verified.error.code);
    const session = await client.auth.getSession();
    assert(session.data.session);
    const claims = JSON.parse(
      Buffer.from(
        session.data.session.access_token.split(".")[1],
        "base64url",
      ).toString(),
    );
    assert.equal(claims.aal, "aal2");
    assert.equal(claims.iss, `https://${ref}.supabase.co/auth/v1`);
    account.session = session.data.session;
    save();
  }
  mkdirSync("docs/qa/batch1-hosted-20261116", { recursive: true });
  const report = {
    at: new Date().toISOString(),
    projectRef: ref,
    syntheticAccounts: 2,
    passwordAuth: true,
    genuinePreviewMfa: true,
    aal: "aal2",
    existingAccountsChanged: 0,
    providerSettingsChanged: 0,
    emailSent: 0,
    smsSent: 0,
    productionConnections: 0,
    applicationHostedAcceptance: false,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(
    e instanceof assert.AssertionError
      ? "Synthetic Auth identity assertion failed"
      : String(e.message).replace(/[^a-zA-Z0-9 :_-]/g, ""),
  );
  process.exitCode = 1;
});
