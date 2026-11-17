import test from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";
import {
  deliverBudgetedSms,
  type SmsBudgetStore,
} from "../../src/server/sms-budget-hook";
const secret = "v1,whsec_" + Buffer.alloc(32, 19).toString("base64");
const config = {
  secret,
  window: "synthetic-sms-window",
  account: "AC" + "a".repeat(32),
  token: "synthetic-only-token",
  service: "MG" + "b".repeat(32),
};
const input = {
  user: { id: "11111111-1111-4111-8111-111111111111", phone: "+61400000000" },
  sms: { otp: "123456", phone: "+61400000000" },
};
function signed(body = JSON.stringify(input), date = new Date()) {
  const id = "test-hook-id";
  return {
    body,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
      "webhook-signature": new Webhook(secret.slice(3)).sign(id, date, body),
    },
  };
}
function fixture() {
  const states = new Map<string, string>();
  let reservations = 0,
    calls = 0;
  const store: SmsBudgetStore = {
    async reserve(_w, f) {
      const old = states.get(f);
      if (old) return old;
      states.set(f, "pending");
      reservations++;
      return "send";
    },
    async finish(_w, f, ok) {
      states.set(f, ok ? "accepted" : "uncertain");
    },
  };
  const send: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(
      String(url),
      `https://api.twilio.com/2010-04-01/Accounts/${config.account}/Messages.json`,
    );
    const body = options?.body as URLSearchParams;
    assert.equal(body.get("MessagingServiceSid"), config.service);
    const text = body.get("Body")!;
    assert(text.length < 160);
    assert.match(text, /^[\x20-\x7e]+$/);
    assert.equal(options?.redirect, "error");
    return Response.json(
      { sid: "SM" + "c".repeat(32), status: "queued" },
      { status: 201 },
    );
  };
  return {
    store,
    send,
    states,
    get reservations() {
      return reservations;
    },
    get calls() {
      return calls;
    },
  };
}
test("signed AU send is single segment; accepted replay sends once", async () => {
  const f = fixture(),
    s = signed();
  await deliverBudgetedSms(s.body, s.headers, config, f.store, f.send);
  await deliverBudgetedSms(s.body, s.headers, config, f.store, f.send);
  assert.equal(f.calls, 1);
  assert.equal(f.reservations, 1);
});
test("invalid/stale signature never reaches reservation or provider", async () => {
  for (const s of [
    signed(JSON.stringify(input), new Date(Date.now() - 600000)),
    { ...signed(), headers: {} },
  ]) {
    const f = fixture();
    await assert.rejects(
      deliverBudgetedSms(s.body, s.headers, config, f.store, f.send),
    );
    assert.equal(f.reservations, 0);
    assert.equal(f.calls, 0);
  }
});
test("signed non-AU number, invalid OTP and oversized payload fail closed", async () => {
  for (const body of [
    JSON.stringify({
      ...input,
      sms: { ...input.sms, phone: "+12025550123" },
    }),
    JSON.stringify({ ...input, sms: { ...input.sms, otp: "not-code" } }),
    " ".repeat(16385),
  ]) {
    const f = fixture(),
      s = signed(body);
    await assert.rejects(
      deliverBudgetedSms(body, s.headers, config, f.store, f.send),
    );
    assert.equal(f.reservations, 0);
  }
});
test("cap, expiry and pending statuses never dispatch", async () => {
  for (const state of ["denied", "pending", "uncertain"]) {
    const f = fixture(),
      s = signed();
    f.store.reserve = async () => state;
    await assert.rejects(
      deliverBudgetedSms(s.body, s.headers, config, f.store, f.send),
    );
    assert.equal(f.calls, 0);
  }
});
test("20 simultaneous duplicate callbacks dispatch at most once", async () => {
  const f = fixture(),
    s = signed();
  await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      deliverBudgetedSms(s.body, s.headers, config, f.store, f.send),
    ),
  );
  assert.equal(f.calls, 1);
  assert.equal(f.reservations, 1);
});
test("provider timeout/failure conserves budget and never retries", async () => {
  for (const outcome of ["timeout", "denied"]) {
    const f = fixture(),
      s = signed();
    let calls = 0;
    const send: typeof fetch = async () => {
      calls++;
      if (outcome === "timeout") throw Error("private provider failure");
      return new Response(null, { status: 401 });
    };
    await assert.rejects(
      deliverBudgetedSms(s.body, s.headers, config, f.store, send),
    );
    await assert.rejects(
      deliverBudgetedSms(s.body, s.headers, config, f.store, send),
    );
    assert.equal(calls, 1);
    assert.equal(f.reservations, 1);
    assert.deepEqual([...f.states.values()], ["uncertain"]);
  }
});
test("accepted send whose persistence fails is never automatically resent", async () => {
  const f = fixture(),
    s = signed();
  f.store.finish = async () => {
    throw Error("database unavailable");
  };
  await assert.rejects(
    deliverBudgetedSms(s.body, s.headers, config, f.store, f.send),
  );
  await assert.rejects(
    deliverBudgetedSms(s.body, s.headers, config, f.store, f.send),
  );
  assert.equal(f.calls, 1);
  assert.deepEqual([...f.states.values()], ["pending"]);
});

test("slow reservation cannot start a late SMS after the hook deadline", async () => {
  const f = fixture(),
    s = signed(),
    reserve = f.store.reserve;
  f.store.reserve = async (...args) => {
    const result = await reserve(...args);
    await new Promise((resolve) => setTimeout(resolve, 3600));
    return result;
  };
  await assert.rejects(
    deliverBudgetedSms(s.body, s.headers, config, f.store, f.send),
  );
  assert.equal(f.calls, 0);
  assert.equal(f.reservations, 1);
  assert.deepEqual([...f.states.values()], ["uncertain"]);
});
