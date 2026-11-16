import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedFetch,
  BoundedRequestError,
} from "../../src/core/bounded-request";
import {
  PhoneThrottleError,
  publicPhoneErrorMessage,
} from "../../src/core/phone-challenge";

test("response headers do not end the body deadline and a timeout never repeats a mutation", async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { arrayBuffer: () => new Promise(() => {}) } as Response;
  };
  try {
    const start = performance.now();
    await assert.rejects(
      boundedFetch("https://isolated.invalid", { method: "POST" }, 25),
      BoundedRequestError,
    );
    assert(performance.now() - start < 1000);
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});
test("caller cancellation stops waiting even when a transport ignores abort", async () => {
  const original = global.fetch;
  global.fetch = () => new Promise(() => {});
  const cancel = new AbortController();
  try {
    const result = boundedFetch(
      "https://isolated.invalid",
      { signal: cancel.signal },
      20000,
    );
    cancel.abort();
    await assert.rejects(result, BoundedRequestError);
  } finally {
    global.fetch = original;
  }
});
test("successful body and response metadata survive the deadline wrapper", async () => {
  const original = global.fetch;
  global.fetch = async () =>
    Response.json(
      { saved: true },
      { status: 201, headers: { "Server-Timing": "receipt;dur=1" } },
    );
  try {
    const result = await boundedFetch("https://isolated.invalid");
    assert.equal(result.status, 201);
    assert.deepEqual(await result.json(), { saved: true });
    assert.equal(result.headers.get("Server-Timing"), "receipt;dur=1");
  } finally {
    global.fetch = original;
  }
});
test("phone throttling exposes only application guidance, never provider diagnostics", () => {
  const throttle = new PhoneThrottleError(
    "Please wait one minute before requesting another code.",
    41,
  );
  assert.equal(publicPhoneErrorMessage(throttle), throttle.message);
  assert.equal(throttle.retryAfterSeconds, 41);
  assert(
    !publicPhoneErrorMessage(
      new PhoneThrottleError("Twilio private diagnostic", 41),
    ).includes("Twilio"),
  );
});
