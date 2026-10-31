import test from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { hostedGoogleAcceptance } from "../../src/server/hosted-google-acceptance";

const config = {
  secret: "a".repeat(64),
  encryptionKey: "b".repeat(64),
  account: "c".repeat(64),
  member: "synthetic-store-acceptance",
  expiresAt: Date.now() + 60_000,
  database:
    "postgres://docked_billing_test.pojoymtniryarxxunyvz:fixture@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres",
  databaseCa: "fixture-only-never-connect",
};
test("hosted boundary rejects unauthorised, browser and invalid-method requests before database/provider access", async () => {
  let providerCalls = 0;
  const handler = hostedGoogleAcceptance(config, async () => {
    providerCalls++;
    throw Error("must not call");
  });
  for (const [headers, method, expected] of [
    [{}, "POST", 401],
    [{ authorization: "Bearer " + "z".repeat(64) }, "POST", 401],
    [{ authorization: "Bearer " + "é".repeat(64) }, "POST", 401],
    [
      {
        authorization: "Bearer " + config.secret,
        origin: "https://docked.com.au",
      },
      "POST",
      403,
    ],
    [
      { authorization: "Bearer " + config.secret, cookie: "session=test" },
      "POST",
      403,
    ],
    [{ authorization: "Bearer " + config.secret }, "GET", 405],
    [
      {
        authorization: "Bearer " + config.secret,
        "content-type": "text/plain",
      },
      "POST",
      405,
    ],
  ] as const) {
    let status = 0,
      body = "";
    const res = {
      setHeader() {},
      set statusCode(value: number) {
        status = value;
      },
      end(value: string) {
        body = value;
      },
    };
    await handler(
      { headers, method } as IncomingMessage,
      res as unknown as ServerResponse,
    );
    assert.equal(status, expected);
    assert.equal(body.includes(config.secret), false);
  }
  assert.equal(providerCalls, 0);
});
test("hosted configuration rejects customer roles, alternate hosts, members and invalid expiry", () => {
  for (const override of [
    { database: config.database.replace("docked_billing_test.", "postgres.") },
    { database: config.database.replace("ap-southeast-2", "us-east-1") },
    { member: "customer" },
    { expiresAt: NaN },
    { expiresAt: 0 },
  ])
    assert.throws(() =>
      hostedGoogleAcceptance({ ...config, ...override }, async () => ""),
    );
});
test("expired hosted session rejects even the correct credential", async () => {
  const handler = hostedGoogleAcceptance(
    { ...config, expiresAt: 1 },
    async () => {
      throw Error();
    },
  );
  let status = 0;
  await handler(
    {
      headers: { authorization: "Bearer " + config.secret },
      method: "POST",
    } as IncomingMessage,
    {
      setHeader() {},
      set statusCode(value: number) {
        status = value;
      },
      end() {},
    } as unknown as ServerResponse,
  );
  assert.equal(status, 401);
});
