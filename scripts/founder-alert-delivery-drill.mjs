/** One explicitly authorised founder email from an isolated DB. No hosted writes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dispatchBillingOpsAlert } from "../src/server/billing-ops-alerts.mjs";
import { sendGraph } from "../supabase/functions/docked-auth-email/mail.mjs";
export async function founderAlertDeliveryDrill(queue, env) {
  assert.equal(
    new URL(process.env.COMMERCIAL_ACCEPTANCE_DB).hostname,
    "127.0.0.1",
  );
  const ref = "DOCKED-OPS-20261110-01",
    dir = "private-data/v31-final-reconciliation-20261110";
  const evidence =
    "docs/qa/v31-final-reconciliation-20261110/email-delivery.json";
  mkdirSync(dir, { recursive: true });
  const intent = dir + "/email-send-intent.private.json";
  assert(
    !existsSync(intent),
    "A send was already attempted: reconcile, never repeat it automatically",
  );
  const base =
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/production/microsoft365/";
  const identity = JSON.parse(
    readFileSync(base + "application-identity.json", "utf8"),
  );
  assert.equal(identity.mailbox, "support@docked.com.au");
  const config = {
    ...env,
    GRAPH_TENANT_ID: identity.tenantId,
    GRAPH_CLIENT_ID: identity.clientId,
    GRAPH_PRIVATE_KEY_PEM: readFileSync(base + "graph-private-key.pem", "utf8"),
    GRAPH_CERTIFICATE_PEM: readFileSync(
      base + "docked-graph-public.cer",
      "utf8",
    ),
  };
  const report = {
    reference: ref,
    subject: `Docked TEST incident drill — ${ref}`,
    recipient: "support@docked.com.au",
    custodian: "Founder",
    environment:
      "Isolated loopback PostgreSQL; existing Microsoft Graph mailbox",
    at: new Date().toISOString(),
    providerAccepted: false,
    inboxVerified: false,
    acknowledged: false,
    productionDatabaseWrites: 0,
    productionPermissionChanges: 0,
    attempts: 0,
    providerRequestId: null,
  };
  const result = await dispatchBillingOpsAlert(queue, config, {
    send: async (messages, providerEnv) => {
      assert.equal(messages.length, 1);
      assert.equal(
        messages[0].toRecipients[0].emailAddress.address,
        report.recipient,
      );
      const message = {
        ...messages[0],
        subject: report.subject,
        body: {
          contentType: "Text",
          content: [
            `Authorised non-destructive TEST incident: ${ref}.`,
            "All fault counts below are isolated fixtures, not a Production incident. No customer record or balance has changed.",
            "Please confirm receipt in the existing Codex chat by quoting this reference. Do not send credentials. This email contains no payment token, phone number or customer details.",
            "Provider acceptance alone is not inbox delivery. Production email automation remains disabled.",
            "",
            messages[0].body.content,
          ].join("\n"),
        },
      };
      writeFileSync(
        intent,
        JSON.stringify({
          reference: ref,
          intentAt: new Date().toISOString(),
          recipient: report.recipient,
        }),
        { flag: "wx", mode: 0o600 },
      );
      report.attempts++;
      await sendGraph([message], providerEnv, async (address, options) => {
        const response = await fetch(address, options);
        if (String(address).endsWith("/sendMail")) {
          report.providerAccepted = response.status === 202;
          report.providerRequestId = response.headers.get("request-id");
          writeFileSync(evidence, JSON.stringify(report, null, 2) + "\n");
        }
        return response;
      });
    },
  });
  const final = { ...report, dispatch: result };
  writeFileSync(evidence, JSON.stringify(final, null, 2) + "\n");
  console.log(JSON.stringify(final));
  return final;
}
