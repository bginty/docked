import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { googleLabHandler } from "../../src/server/google-play-lab-http";
import { GooglePlayTestVerifier } from "../../src/server/store-purchase-verification";
import type { IncomingMessage, ServerResponse } from "node:http";

const secret = "a".repeat(64);
test("expired lab pairing cannot read data or invoke provider operations", async () => {
  let calls = 0,
    status = 0,
    body = "";
  const operation = async () => {
    calls++;
  };
  const handler = googleLabHandler(
    {
      session: operation,
      receipt: operation,
      reconcile: operation,
      refund: operation,
    },
    secret,
    Date.now() - 1,
  );
  await handler(
    {
      method: "GET",
      url: "/session",
      socket: { remoteAddress: "127.0.0.1" },
      headers: { host: "127.0.0.1:48591", authorization: "Bearer " + secret },
    } as IncomingMessage,
    {
      writeHead: (code: number) => {
        status = code;
      },
      end: (text: string) => {
        body = text;
      },
    } as unknown as ServerResponse,
  );
  assert.equal(status, 401);
  assert.equal(calls, 0);
  assert.equal(body.includes(secret), false);
});
test("native lab rejects web, missing/expired pairing, hostile fields and nonlocal host before settlement", async () => {
  let calls = 0;
  const operation = async () => {
    calls++;
    return { balance: 0 };
  };
  const server = createServer(
    googleLabHandler(
      {
        session: operation,
        receipt: operation,
        reconcile: operation,
        refund: operation,
        pack: async (id, command) => {
          assert.equal(id, "synthetic-request");
          assert.deepEqual(command, { kind: "buy-pack" });
          return operation();
        },
      },
      secret,
      Date.now() + 60000,
    ),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const send = (
    path: string,
    body?: string,
    extra: Record<string, string> = {},
  ) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method: body === undefined ? "GET" : "POST",
          headers: {
            host: "127.0.0.1:48591",
            authorization: "Bearer " + secret,
            "content-type": "application/json",
            ...extra,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => {
            data += c;
          });
          res.on("end", () => resolve({ status: res.statusCode!, body: data }));
        },
      );
      req.on("error", reject);
      req.end(body);
    });
  try {
    assert.equal(
      (await send("/session", undefined, { origin: "https://docked.com.au" }))
        .status,
      403,
    );
    assert.equal(
      (await send("/session", undefined, { host: "attacker.example" })).status,
      403,
    );
    assert.equal(
      (
        await send("/session", undefined, {
          authorization: "Bearer " + "x".repeat(64),
        })
      ).status,
      401,
    );
    assert.equal(
      (await send("/session", undefined, { authorization: "" })).status,
      401,
    );
    assert.equal(
      (
        await send(
          "/receipt",
          JSON.stringify({ token: "test", member: "victim", credits: 999999 }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await send("/receipt", JSON.stringify({ token: "test" }), {
          "content-type": "text/plain",
        })
      ).status,
      415,
    );
    assert.equal((await send("/receipt", '"not-an-object"')).status, 400);
    assert.equal((await send("/receipt", "x".repeat(8193))).status, 413);
    for (const body of [
      { request: "x", command: {} },
      { request: "synthetic-request", command: {}, member: "victim" },
      { request: "synthetic-request", command: {}, credits: 9900 },
    ])
      assert.equal((await send("/pack", JSON.stringify(body))).status, 400);
    assert.equal(calls, 0);
    assert.equal((await send("/session")).status, 200);
    assert.equal(
      (await send("/receipt", JSON.stringify({ token: "synthetic" }))).status,
      200,
    );
    assert.equal((await send("/reconcile", "{}")).status, 200);
    assert.equal(
      (await send("/refund", JSON.stringify({ key: "b".repeat(64) }))).status,
      200,
    );
    assert.equal(calls, 4);
    assert.equal(
      (
        await send(
          "/pack",
          JSON.stringify({
            request: "synthetic-request",
            command: { kind: "buy-pack" },
          }),
        )
      ).status,
      200,
    );
    assert.equal(calls, 5);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("test refund derives order only from freshly verified Google test receipt", async () => {
  for (const invalid of [
    "real",
    "other-account",
    "pending",
    "missing-order",
    "unknown-product",
  ]) {
    let writes = 0;
    const body: any = {
      orderId: "GPA.1234-1234-1234-12345",
      testPurchaseContext: { fopType: "TEST" },
      obfuscatedExternalAccountId: "bound",
      regionCode: "AU",
      purchaseStateContext: { purchaseState: "PURCHASED" },
      productLineItem: [
        {
          productId: "test",
          productOfferDetails: { quantity: 1, refundableQuantity: 1 },
        },
      ],
    };
    if (invalid === "real") delete body.testPurchaseContext;
    if (invalid === "other-account") body.obfuscatedExternalAccountId = "other";
    if (invalid === "pending")
      body.purchaseStateContext.purchaseState = "PENDING";
    if (invalid === "missing-order") delete body.orderId;
    if (invalid === "unknown-product")
      body.productLineItem[0].productId = "unapproved";
    const v = new GooglePlayTestVerifier(
      "docked.fantasy",
      [{ id: "test", credits: 4900, scope: "account", version: "test" }],
      async () => "test-oauth",
      async (_url, options) => {
        if (options?.method === "POST") writes++;
        return Response.json(body);
      },
    );
    await assert.rejects(v.refundTestPurchase("test-token", "bound"));
    assert.equal(writes, 0, invalid);
  }
});

test("test refund lost response reconciles reversal and duplicate retry does not refund twice", async () => {
  let writes = 0,
    refunded = false;
  const v = new GooglePlayTestVerifier(
    "docked.fantasy",
    [{ id: "test", credits: 4900, scope: "account", version: "test" }],
    async () => "test-oauth",
    async (url, options) => {
      if (options?.method === "POST") {
        assert.match(
          String(url),
          /orders\/GPA\.1234-1234-1234-12345:refund\?revoke=true$/,
        );
        writes++;
        refunded = true;
        return new Response(null, { status: 503 });
      }
      return Response.json({
        orderId: "GPA.1234-1234-1234-12345",
        testPurchaseContext: { fopType: "TEST" },
        obfuscatedExternalAccountId: "bound",
        regionCode: "AU",
        purchaseStateContext: { purchaseState: "PURCHASED" },
        productLineItem: [
          {
            productId: "test",
            productOfferDetails: {
              quantity: 1,
              refundableQuantity: refunded ? 0 : 1,
            },
          },
        ],
      });
    },
  );
  assert.equal(
    (await v.refundTestPurchase("test-token", "bound")).alreadyReversed,
    true,
  );
  await v.refundTestPurchase("test-token", "bound");
  assert.equal(writes, 1);
});
