/** Exact known TEST Sent Items metadata only. No send, inbox, grants or consent. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { graphAssertion } from "../supabase/functions/docked-auth-email/mail.mjs";

assert.equal(process.argv[2], "--read-only-known-test");
const directory =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/production/microsoft365/";
const identity = JSON.parse(
  readFileSync(directory + "application-identity.json", "utf8"),
);
assert.equal(identity.mailbox, "support@docked.com.au");
assert.equal(identity.tenantId, "b34880d6-d28e-40c2-b389-232506c69650");
const env = {
  GRAPH_TENANT_ID: identity.tenantId,
  GRAPH_CLIENT_ID: identity.clientId,
  GRAPH_PRIVATE_KEY_PEM: readFileSync(
    directory + "graph-private-key.pem",
    "utf8",
  ),
  GRAPH_CERTIFICATE_PEM: readFileSync(
    directory + "docked-graph-public.cer",
    "utf8",
  ),
};
const { endpoint, assertion } = await graphAssertion(env);
const response = await fetch(endpoint, {
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
assert.equal(response.status, 200, "Existing Graph authentication unavailable");
const token = await response.json();
assert.equal(token.token_type?.toLowerCase(), "bearer");
assert.equal(typeof token.access_token, "string");
const claims = JSON.parse(
  Buffer.from(token.access_token.split(".")[1], "base64url").toString(),
);
assert.equal(claims.tid, identity.tenantId);
assert.equal(claims.appid ?? claims.azp, identity.clientId);
const subject = "Docked TEST incident drill — DOCKED-OPS-20261110-01";
const url = new URL(
  "https://graph.microsoft.com/v1.0/users/support%40docked.com.au/mailFolders/sentitems/messages",
);
url.searchParams.set(
  "$filter",
  `subject eq '${subject}' and sentDateTime ge 2026-11-10T01:00:00Z and sentDateTime lt 2026-11-10T01:10:00Z`,
);
url.searchParams.set(
  "$select",
  "id,subject,sentDateTime,toRecipients,internetMessageId",
);
url.searchParams.set("$top", "2");
const result = await fetch(url, {
  method: "GET",
  redirect: "error",
  signal: AbortSignal.timeout(15000),
  headers: { Authorization: `Bearer ${token.access_token}` },
});
const payload = await result.json();
const matches = [];
if (result.ok) {
  assert(Array.isArray(payload.value));
  for (const message of payload.value) {
    assert.equal(message.subject, subject);
    assert.deepEqual(
      message.toRecipients.map((r) => r.emailAddress.address.toLowerCase()),
      [identity.mailbox],
    );
    matches.push({
      sentAt: message.sentDateTime,
      messageIdSha256: createHash("sha256").update(message.id).digest("hex"),
      internetMessageIdSha256: message.internetMessageId
        ? createHash("sha256").update(message.internetMessageId).digest("hex")
        : null,
    });
  }
}
const errorCode =
  typeof payload.error?.code === "string" &&
  /^[A-Za-z0-9_]+$/.test(payload.error.code)
    ? payload.error.code
    : null;
const report = {
  checkedAt: new Date().toISOString(),
  reference: "DOCKED-OPS-20261110-01",
  method:
    "Existing certificate client_credentials; exact-subject/time-window GET to approved founder Sent Items; selected metadata only",
  tokenIssued: true,
  tokenRoles: claims.roles ?? [],
  tokenRolesLimitation:
    "Token roles do not enumerate Exchange application RBAC",
  sentItemsStatus: result.status,
  errorCode,
  exactMatches: matches,
  providerRequestId: result.headers.get("request-id"),
  inboxRead: false,
  providerDeliveryTraceInspected: false,
  permissionsChanged: false,
  emailsSent: 0,
  credentialsUsedInMemory:
    "Existing Graph certificate; no credential output or storage",
  result:
    result.status === 403
      ? "Existing application cannot read Sent Items; do not expand its send-only permissions for this audit"
      : result.ok
        ? "Sent Items metadata checked; this is not delivery evidence"
        : "Read-only provider check failed; no resend or permission changes",
};
token.access_token = "";
env.GRAPH_PRIVATE_KEY_PEM = "";
writeFileSync(
  "docs/qa/v31-operational-acceptance-20261110/graph-trace-readonly.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    status: report.sentItemsStatus,
    exactMatches: matches.length,
    errorCode,
    emailsSent: 0,
  }),
);
