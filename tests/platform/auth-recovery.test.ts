import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasRecoveryVerifier,
  recoveryRequest,
} from "../../src/core/auth-recovery";
const origin = "https://docked-production-fixture.vercel.app",
  token = "pkce_" + "a".repeat(64);
const link = origin + "/auth/recovery?type=recovery&token_hash=" + token;
const post = (
  body = new URLSearchParams({ type: "recovery", token_hash: token }),
  from = origin,
) =>
  new Request(origin + "/auth/recovery", {
    method: "POST",
    headers: { Origin: from },
    body,
  });
test("recovery link scanners cannot consume tokens; only explicit POST reaches provider", async () => {
  let calls = 0;
  const deps = {
    enabled: true,
    siteUrl: origin,
    canContinue: async () => {
      calls++;
      return "ready" as const;
    },
  };
  for (const method of ["GET", "GET", "HEAD", "OPTIONS"]) {
    const r = await recoveryRequest(new Request(link, { method }), deps);
    assert.equal(r.status, method === "GET" ? 200 : 405);
    assert.equal(r.headers.get("location"), null);
    assert.match(r.headers.get("cache-control")!, /no-store/);
    assert.equal(r.headers.get("referrer-policy"), "strict-origin");
    assert.match(
      r.headers.get("content-security-policy")!,
      /form-action 'self' https:\/\/pojoymtniryarxxunyvz\.supabase\.co\/auth\/v1\/verify;/,
    );
    const html = await r.text();
    assert.doesNotMatch(html, /supabase\.co|<script|http-equiv/i);
    if (method === "GET") assert.match(html, /method="post"/);
  }
  assert.equal(calls, 0);
  const r = await recoveryRequest(post(), deps);
  assert.equal(calls, 1);
  assert.equal(r.status, 303);
  const target = new URL(r.headers.get("location")!);
  assert.equal(target.origin, "https://pojoymtniryarxxunyvz.supabase.co");
  assert.equal(target.pathname, "/auth/v1/verify");
  assert.equal(target.searchParams.get("token"), token);
  assert.equal(target.searchParams.get("type"), "recovery");
  assert.equal(
    target.searchParams.get("redirect_to"),
    origin + "/auth/callback?next=/app/reset-password",
  );
});
test("recovery rejects cross-origin, duplicated, wrong-action and oversized requests before continuation", async () => {
  let calls = 0;
  for (const request of [
    post(undefined, "https://attacker.invalid"),
    new Request(link.replace(origin, "https://attacker.invalid")),
    post(
      new URLSearchParams(
        "type=recovery&token_hash=" + token + "&token_hash=" + token,
      ),
    ),
    post(new URLSearchParams({ type: "invite", token_hash: token })),
    post(
      new URLSearchParams({
        type: "recovery",
        token_hash: "<script>alert(1)</script>",
      }),
    ),
    post(
      new URLSearchParams({ type: "recovery", token_hash: "a".repeat(4000) }),
    ),
    new Request(link, {
      method: "POST",
      body: "type=recovery&token_hash=" + token,
    }),
  ]) {
    const r = await recoveryRequest(request, {
      enabled: true,
      siteUrl: origin,
      canContinue: async () => {
        calls++;
        return "ready";
      },
    });
    assert.ok(r.status >= 400);
    assert.equal(r.headers.get("location"), null);
  }
  assert.equal(calls, 0);
});
test("missing PKCE cookie, unavailable service and closed gate never consume token or claim expiry", async () => {
  for (const state of ["missing-browser", "unavailable"] as const) {
    const r = await recoveryRequest(post(), {
      enabled: true,
      siteUrl: origin,
      canContinue: async () => state,
    });
    assert.equal(r.status, state === "missing-browser" ? 409 : 503);
    assert.equal(r.headers.get("location"), null);
    const html = await r.text();
    assert.doesNotMatch(html, new RegExp(token));
    assert.match(html, /has not used your link/);
  }
  const deps = {
    siteUrl: origin,
    canContinue: async () => {
      throw Error("private");
    },
  };
  assert.equal(
    (await recoveryRequest(post(), { ...deps, enabled: false })).status,
    503,
  );
  const r = await recoveryRequest(post(), { ...deps, enabled: true });
  assert.equal(r.status, 503);
  assert.doesNotMatch(await r.text(), /private/);
});
test("recovery verifier presence is bound to the dedicated project and supports SSR chunks", () => {
  const name = "sb-pojoymtniryarxxunyvz-auth-token-code-verifier";
  assert.equal(hasRecoveryVerifier([]), false);
  assert.equal(hasRecoveryVerifier([{ name, value: "" }]), false);
  assert.equal(
    hasRecoveryVerifier([
      { name: "sb-other-auth-token-code-verifier", value: "fixture" },
    ]),
    false,
  );
  assert.equal(
    hasRecoveryVerifier([{ name: name + ".evil", value: "fixture" }]),
    false,
  );
  for (const suffix of ["", ".0", ".1"])
    assert.equal(
      hasRecoveryVerifier([{ name: name + suffix, value: "fixture" }]),
      true,
    );
});
