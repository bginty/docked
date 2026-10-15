// Operator only. Exact user-selected owner, exact isolated Preview. Never grants
// roles, confirms an email, sets a password or enrolls MFA for the recipient.
import { readFile, writeFile, access } from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const dir = "private-data/private-preview-release/";
const ref = "bckkllmndoxzpzdqrevb";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const email = "support@docked.com.au";
try {
  assert.equal(process.argv[2], "--prepare");
  const c = JSON.parse(
    await readFile("private-data/hosted-preview/connection.json", "utf8"),
  );
  assert.equal(c.projectRef, ref);
  assert.equal(c.supabaseUrl, `https://${ref}.supabase.co`);
  // No automatic regeneration after an uncertain outcome.
  const intent = dir + "owner-invite-intent.private.json";
  assert.equal(
    await access(intent).then(
      () => true,
      () => false,
    ),
    false,
    "Reconcile existing invitation intent first",
  );
  const client = createClient(c.supabaseUrl, c.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) {
    console.error(
      JSON.stringify({
        stage: "list-users",
        status: users.error.status,
        code: users.error.code,
      }),
    );
    throw Error("Auth lookup failed");
  }
  assert.equal(users.error, null);
  assert.ok(users.data.users.length < 1000);
  assert.equal(
    users.data.users.filter((u) => u.email?.toLowerCase() === email).length,
    0,
    "Existing owner requires a separately reviewed recovery flow",
  );
  await writeFile(
    intent,
    JSON.stringify({
      email,
      projectRef: ref,
      createdAt: new Date().toISOString(),
    }),
    { flag: "wx", mode: 0o600 },
  );
  const { data, error } = await client.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: origin + "/auth/invite" },
  });
  if (error)
    throw Error(
      "Invitation preparation failed; reconcile exact account before retrying",
    );
  assert.equal(data.user.email.toLowerCase(), email);
  assert.ok(!data.user.email_confirmed_at);
  assert.match(data.properties.hashed_token, /^[a-zA-Z0-9_-]{20,256}$/);
  const link = `${origin}/auth/invite?type=invite&token_hash=${data.properties.hashed_token}`;
  await writeFile(
    dir + "owner.private.json",
    JSON.stringify({ email, id: data.user.id }),
    { flag: "wx", mode: 0o600 },
  );
  await writeFile(
    dir + "owner-invite.private.json",
    JSON.stringify({
      email,
      id: data.user.id,
      link,
      createdAt: new Date().toISOString(),
    }),
    { flag: "wx", mode: 0o600 },
  );
  const report = {
    prepared: true,
    projectRef: ref,
    owner: "support@docked.com.au",
    emailConfirmed: false,
    mfaEnrolled: false,
    rolesGranted: false,
    mailSent: false,
  };
  await writeFile(
    "docs/qa/private-preview-release/owner-invite.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (e) {
  console.error(
    JSON.stringify({
      failed: true,
      code: e.code ?? e.name,
      detail:
        "Owner invitation outcome requires reconciliation; private data withheld",
    }),
  );
  process.exitCode = 1;
}
