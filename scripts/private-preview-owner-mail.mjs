// Exact-owner invitation delivery via the existing Docked mailbox. No web-app
// credentials, provider configuration or permissions are changed.
import { readFile, writeFile, access } from "node:fs/promises";
import assert from "node:assert/strict";
import { graphAssertion } from "../supabase/functions/docked-auth-email/mail.mjs";
const dir = "private-data/private-preview-release/";
try {
  assert.equal(process.argv[2], "--send");
  const verified = JSON.parse(
    await readFile("docs/qa/private-preview-release/hosted.json", "utf8"),
  );
  assert.equal(verified.passed, true);
  assert.equal(
    verified.origin,
    "https://docked-preview-s24-briant-ginty.vercel.app",
  );
  const invitation = JSON.parse(
    await readFile(dir + "owner-invite.private.json", "utf8"),
  );
  assert.equal(invitation.email, "support@docked.com.au");
  const link = new URL(invitation.link);
  assert.equal(link.origin, verified.origin);
  assert.equal(link.pathname, "/auth/invite");
  assert.ok(
    Date.now() - Date.parse(invitation.createdAt) < 50 * 60 * 1000,
    "Invitation too old; reconcile rather than send",
  );
  const receipt = dir + "owner-mail-intent.private.json";
  assert.equal(
    await access(receipt).then(
      () => true,
      () => false,
    ),
    false,
    "Do not repeat an uncertain send",
  );
  const identity = JSON.parse(
    await readFile(
      "private-data/production/microsoft365/application-identity.json",
      "utf8",
    ),
  );
  assert.equal(identity.mailbox, "support@docked.com.au");
  const { endpoint, assertion } = await graphAssertion({
    GRAPH_TENANT_ID: identity.tenantId,
    GRAPH_CLIENT_ID: identity.clientId,
    GRAPH_PRIVATE_KEY_PEM: await readFile(
      "private-data/production/microsoft365/graph-private-key.pem",
      "utf8",
    ),
    GRAPH_CERTIFICATE_PEM: await readFile(
      "private-data/production/microsoft365/docked-graph-public.cer",
      "utf8",
    ),
  });
  const tokenResponse = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: identity.clientId,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
    }),
  });
  assert.ok(tokenResponse.ok);
  const token = await tokenResponse.json();
  assert.equal(token.token_type.toLowerCase(), "bearer");
  const message = {
    subject: "Docked private Preview — owner account setup",
    toRecipients: [{ emailAddress: { address: invitation.email } }],
    body: {
      contentType: "Text",
      content: `Your separate Docked Preview owner account is ready to set up.\n\n1. Open this one-time link. If Vercel asks, sign in with your authorised Vercel account first.\n${link.href}\n\n2. Confirm your invitation and choose your own password.\n3. Add your authenticator and verify its six-digit code.\n4. Return to the deployment conversation once “Owner MFA verified” appears.\n\nMFA is required for the owner, not ordinary members such as Barry and Luke. Gameplay and member admission remain closed while setup is completed. This is isolated Preview; it does not change your existing Docked account or assets. Beta credits have no cash value. Never share this link or your authenticator codes.\n\nDocked\nSupport: support@docked.com.au`,
    },
  };
  await writeFile(
    receipt,
    JSON.stringify({
      at: new Date().toISOString(),
      recipient: invitation.email,
    }),
    { flag: "wx", mode: 0o600 },
  );
  const sent = await fetch(
    "https://graph.microsoft.com/v1.0/users/support%40docked.com.au/sendMail",
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    },
  );
  assert.equal(sent.status, 202);
  const report = {
    submitted: true,
    recipient: "support@docked.com.au",
    at: new Date().toISOString(),
    inboxDeliveryVerified: false,
    barryLukeInvitationsSent: false,
  };
  await writeFile(
    "docs/qa/private-preview-release/owner-mail.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (e) {
  console.error(
    JSON.stringify({
      failed: true,
      code: e.code ?? e.name,
      detail:
        "Invitation delivery not confirmed; reconcile intent before retrying",
    }),
  );
  process.exitCode = 1;
}
