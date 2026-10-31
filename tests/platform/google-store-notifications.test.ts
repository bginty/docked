import test, { before } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { createHash } from "node:crypto";
import { verifyGooglePush } from "../../src/server/google-store-notifications";
const policy = {
  audience: "https://example.invalid/google-notifications",
  serviceAccount: "push@example-project.iam.gserviceaccount.com",
  subscription: "projects/test/subscriptions/play",
  packageName: "docked.fantasy" as const,
};
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let keyset: ReturnType<typeof createLocalJWKSet>;
before(async () => {
  keys = await generateKeyPair("RS256");
  keyset = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: "fixture" }],
  });
});
async function token(claims = {}) {
  return new SignJWT({
    email: policy.serviceAccount,
    email_verified: true,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "fixture" })
    .setIssuer("https://accounts.google.com")
    .setAudience(policy.audience)
    .setSubject("synthetic-google-push")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(keys.privateKey);
}
function body(
  notification = {
    oneTimeProductNotification: {
      purchaseToken: "synthetic-token",
      sku: "ignored-client-amount",
      notificationType: 1,
    },
  },
) {
  return {
    subscription: policy.subscription,
    message: {
      messageId: "fixture-event",
      data: Buffer.from(
        JSON.stringify({
          packageName: policy.packageName,
          eventTimeMillis: "1793400000000",
          ...notification,
        }),
      ).toString("base64"),
    },
  };
}
async function request(data: unknown = body(), claims = {}, headers = {}) {
  return new Request(policy.audience, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await token(claims)}`,
      ...headers,
    },
    body: JSON.stringify(data),
  });
}
test("signed Google push produces only a stable refresh hint, no client credit or member", async () => {
  const n = await verifyGooglePush(await request(), policy, keyset);
  assert.equal(
    n.receiptKey,
    createHash("sha256")
      .update("docked.fantasy\0synthetic-token")
      .digest("hex"),
  );
  assert.equal(n.kind, "purchase");
  assert.deepEqual(n, await verifyGooglePush(await request(), policy, keyset));
  assert.ok(!JSON.stringify(n).includes("synthetic-token"));
  assert.deepEqual(Object.keys(n).sort(), [
    "id",
    "kind",
    "occurredAt",
    "receiptKey",
  ]);
});
test("wrong push account, unverified email, browser origin and cookies denied", async () => {
  for (const claims of [
    { email: "attacker@example-project.iam.gserviceaccount.com" },
    { email_verified: false },
  ])
    await assert.rejects(
      verifyGooglePush(await request(body(), claims), policy, keyset),
      /denied/,
    );
  for (const headers of [
    { origin: "https://docked.com.au" },
    { cookie: "session=synthetic" },
  ])
    await assert.rejects(
      verifyGooglePush(await request(body(), {}, headers), policy, keyset),
      /boundary/,
    );
});
test("wrong issuer/audience/signature and expired tokens rejected by cryptographic verifier", async () => {
  const other = await generateKeyPair("RS256");
  for (const variant of ["issuer", "audience", "expired", "signature"]) {
    const t = await new SignJWT({
      email: policy.serviceAccount,
      email_verified: true,
    })
      .setProtectedHeader({ alg: "RS256", kid: "fixture" })
      .setIssuer(
        variant === "issuer"
          ? "https://evil.invalid"
          : "https://accounts.google.com",
      )
      .setAudience(variant === "audience" ? "elsewhere" : policy.audience)
      .setSubject("subject")
      .setIssuedAt()
      .setExpirationTime(variant === "expired" ? 1 : "1h")
      .sign(variant === "signature" ? other.privateKey : keys.privateKey);
    await assert.rejects(
      verifyGooglePush(
        await request(body(), {}, { authorization: `Bearer ${t}` }),
        policy,
        keyset,
      ),
      /denied/,
    );
  }
});
test("wrong subscription/package, malformed/oversized body and ambiguous notifications rejected", async () => {
  const b = body();
  const ambiguous = body();
  ambiguous.message.data = Buffer.from(
    JSON.stringify({
      packageName: policy.packageName,
      eventTimeMillis: "1",
      testNotification: { version: "1" },
      oneTimeProductNotification: {
        purchaseToken: "synthetic-token",
        sku: "test",
        notificationType: 1,
      },
    }),
  ).toString("base64");
  await assert.rejects(
    verifyGooglePush(await request(ambiguous), policy, keyset),
    /Invalid/,
  );
  for (const data of [
    { ...b, subscription: "projects/other/subscriptions/other" },
    { ...b, message: { ...b.message, data: "!!!" } },
    { padding: "x".repeat(17000) },
    {
      ...b,
      message: {
        ...b.message,
        data: Buffer.from(
          JSON.stringify({
            packageName: "other",
            eventTimeMillis: "1",
            testNotification: { version: "1" },
          }),
        ).toString("base64"),
      },
    },
  ])
    await assert.rejects(
      verifyGooglePush(await request(data), policy, keyset),
      /Invalid/,
    );
});
test("voided purchase and test notifications do not carry executable refund amounts", async () => {
  const b = body();
  for (const [notification, kind] of [
    [
      {
        voidedPurchaseNotification: {
          purchaseToken: "synthetic-token",
          productType: 2,
        },
      },
      "voided",
    ],
    [{ testNotification: { version: "1" } }, "test"],
  ] as const) {
    b.message.data = Buffer.from(
      JSON.stringify({
        packageName: policy.packageName,
        eventTimeMillis: "1",
        ...notification,
      }),
    ).toString("base64");
    assert.equal(
      (await verifyGooglePush(await request(b), policy, keyset)).kind,
      kind,
    );
  }
});
