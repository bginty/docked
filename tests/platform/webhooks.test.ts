import { test } from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";
import { verifyEmailWebhook } from "../../src/server/webhooks";
test("signed webhook accepts unchanged payload and rejects tampering/replay age", () => {
  const secret =
    "whsec_" +
    Buffer.from("fictional-testing-secret-32-bytes!!").toString("base64");
  const body = JSON.stringify({
    type: "email.complained",
    data: { email_id: "fixture" },
  });
  const at = new Date(),
    id = "fixture-msg";
  const wh = new Webhook(secret);
  const signature = wh.sign(id, at, body);
  const headers = {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(at.getTime() / 1000)),
    "svix-signature": signature,
  };
  assert.equal(
    verifyEmailWebhook(body, headers, secret).type,
    "email.complained",
  );
  assert.throws(() => verifyEmailWebhook(body + " ", headers, secret));
  assert.throws(() =>
    verifyEmailWebhook(body, { ...headers, "svix-timestamp": "1" }, secret),
  );
});
