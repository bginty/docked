import test from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";
import { deliverBudgetedSms } from "../../src/server/sms-budget-hook";

const config = {
  secret: "v1,whsec_" + Buffer.alloc(32, 29).toString("base64"),
  window: "fictional-phone-change",
  account: "AC" + "a".repeat(32),
  service: "MG" + "b".repeat(32),
  token: "fictional-token-no-network",
};
const userId = "11111111-1111-4111-8111-111111111111";

// GoTrue v2.198.0 phone.go and v0hooks.go: a phone-change target is in sms.phone;
// user.phone may be missing or still hold the previous verified number.
async function exercise(userPhone: string | undefined, target: unknown) {
  const raw = JSON.stringify({
    user: {
      id: userId,
      ...(userPhone === undefined ? {} : { phone: userPhone }),
    },
    sms: { otp: "123456", ...(target === undefined ? {} : { phone: target }) },
  });
  const date = new Date(),
    id = "fictional-hook-event";
  const headers = {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
    "webhook-signature": new Webhook(config.secret.slice(3)).sign(
      id,
      date,
      raw,
    ),
  };
  let reservations = 0,
    sends = 0;
  const action = () =>
    deliverBudgetedSms(
      raw,
      headers,
      config,
      {
        async reserve(window, _fingerprint, user) {
          assert.equal(window, config.window);
          assert.equal(user, userId);
          reservations++;
          return "send";
        },
        async finish(_window, _fingerprint, accepted) {
          assert.equal(accepted, true);
        },
      },
      async (_url, options) => {
        sends++;
        assert.equal(
          (options?.body as URLSearchParams).get("To"),
          "+61400000000",
        );
        return Response.json(
          { sid: "SM" + "c".repeat(32), status: "queued" },
          { status: 201 },
        );
      },
    );
  return { action, counts: () => ({ reservations, sends }) };
}

test("current Auth first-phone and change-phone payloads use the signed SMS target", async () => {
  for (const previous of [undefined, "", "61411111111"]) {
    const f = await exercise(previous, "61400000000");
    await f.action();
    assert.deepEqual(f.counts(), { reservations: 1, sends: 1 });
  }
});

test("missing or invalid SMS target never falls back to an old account phone", async () => {
  for (const target of [undefined, "", "+12025550123", "not-a-phone"]) {
    const f = await exercise("61400000000", target);
    await assert.rejects(f.action());
    assert.deepEqual(f.counts(), { reservations: 0, sends: 0 });
  }
});
