import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mfaFlow } from "../../src/core/mfa-service";
import { resolveTotpFactor, mfaDestination } from "../../src/core/mfa-flow";
const factor = {
  id: "internal-never-shown",
  factor_type: "totp",
  status: "verified",
  created_at: "2026-01-01",
};
function fixture(factors = [factor], aal = "aal1") {
  const calls: string[] = [];
  const auth = {
    getUser: async () => ({ data: { user: { id: "owner" } }, error: null }),
    mfa: {
      listFactors: async () => ({ data: { all: factors }, error: null }),
      getAuthenticatorAssuranceLevel: async () => ({
        data: { currentLevel: aal },
        error: null,
      }),
      enroll: async () => {
        calls.push("enroll");
        return {
          data: {
            totp: { qr_code: "<svg></svg>", secret: "LOCAL-TEST-SETUP" },
          },
          error: null,
        };
      },
      challengeAndVerify: async (input: { factorId: string; code: string }) => {
        calls.push(input.factorId + ":" + input.code);
        return { error: null };
      },
    },
  } as unknown as SupabaseClient["auth"];
  return { auth, calls };
}
test("MFA automatically uses verified own factor, never exposes factor ID or reenrols", async () => {
  const f = fixture();
  assert.deepEqual(await mfaFlow(f.auth, "mfa_status"), {
    ok: true,
    mode: "challenge",
  });
  assert.deepEqual(await mfaFlow(f.auth, "mfa_enroll"), {
    ok: true,
    mode: "challenge",
  });
  assert.deepEqual(await mfaFlow(f.auth, "mfa_verify", "123456"), {
    ok: true,
    mode: "verified",
    redirect: "/app",
  });
  assert.deepEqual(f.calls, ["internal-never-shown:123456"]);
});
test("MFA AAL2 session persists without another code or new factor", async () => {
  const f = fixture([factor], "aal2");
  assert.equal((await mfaFlow(f.auth, "mfa_status")).redirect, "/app");
  assert.deepEqual(f.calls, []);
});
test("First enrolment provides a QR image and once-only setup key; pending factor is reused", async () => {
  const f = fixture([]);
  assert.equal((await mfaFlow(f.auth, "mfa_status")).mode, "enroll");
  const r = await mfaFlow(f.auth, "mfa_enroll");
  assert.match(r.qrCode!, /^data:image\/svg\+xml/);
  assert.equal(r.setupKey, "LOCAL-TEST-SETUP");
  assert.equal("factorId" in r, false);
  const pending = fixture([{ ...factor, status: "unverified" }]);
  assert.equal((await mfaFlow(pending.auth, "mfa_enroll")).mode, "challenge");
  assert.deepEqual(pending.calls, []);
});
test("Invalid codes, factor confusion and redirects fail safely", async () => {
  const f = fixture();
  assert.ok((await mfaFlow(f.auth, "mfa_verify", "123")).error);
  assert.deepEqual(f.calls, []);
  assert.equal(
    resolveTotpFactor([
      { ...factor, id: "phone", factor_type: "phone" },
      factor,
    ])?.id,
    factor.id,
  );
  assert.equal(mfaDestination("https://attacker.invalid"), "/app");
  assert.equal(mfaDestination("/app/reset-password"), "/app/reset-password");
  const signedOut = fixture();
  signedOut.auth.getUser = async () =>
    ({ data: { user: null }, error: new Error("no") }) as any;
  assert.ok((await mfaFlow(signedOut.auth, "mfa_enroll")).error);
  assert.deepEqual(signedOut.calls, []);
});
