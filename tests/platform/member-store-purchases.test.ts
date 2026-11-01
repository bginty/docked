import test from "node:test";
import assert from "node:assert/strict";
import { MemberStoreTestPurchases } from "../../src/server/member-store-purchases";
import { storeAccountId } from "../../src/server/store-purchase-verification";
import { storePackReceipt } from "../fixtures/store-pack-lifecycle";

function fixture() {
  const receipt = storePackReceipt();
  const granted = {
    version: "isolated-test-v1",
    expiresAt: Date.now() + 60000,
    products: [receipt.product],
  };
  let session = "verified-session",
    enabled = true,
    verifyCalls = 0,
    accepted = 0;
  const deps = {
    authenticate: async () => ({ member: "fixture-member", session }),
    admission: async () => (enabled ? granted : null),
    rateLimit: async () => true,
    bindingSecret: "synthetic-secret-not-a-deployed-credential",
    verify: async (_token: string, account: string) => {
      verifyCalls++;
      return { ...receipt, account };
    },
    accept: async (_receipt: unknown, member: string, account: string) => {
      assert.equal(member, "fixture-member");
      assert.equal(account, storeAccountId(member, deps.bindingSecret));
      accepted++;
    },
  };
  return {
    deps,
    service: new MemberStoreTestPurchases(deps),
    granted,
    revoke: () => {
      enabled = false;
    },
    changeSession: () => {
      session = "another-session";
    },
    counts: () => ({ verifyCalls, accepted }),
  };
}
test("member binding and approved allocation come from authenticated server state", async () => {
  const f = fixture(),
    s = await f.service.session();
  assert.equal(s.member, "fixture-member");
  assert.equal(
    s.accountBinding,
    storeAccountId("fixture-member", f.deps.bindingSecret),
  );
  assert.equal(s.products[0].credits, 9900);
  const result = await f.service.receipt({ token: "synthetic-token" });
  assert.equal(result.state, "PURCHASED");
  assert.deepEqual(f.counts(), { verifyCalls: 1, accepted: 1 });
});
test("client cannot select member, credits, product, environment, account or refund action", async () => {
  const f = fixture();
  for (const field of [
    "member",
    "credits",
    "product",
    "environment",
    "account",
    "refund",
  ])
    await assert.rejects(
      f.service.receipt({ token: "synthetic-token", [field]: "forged" }),
      /Invalid purchase/,
    );
  assert.deepEqual(f.counts(), { verifyCalls: 0, accepted: 0 });
});
test("disabled, expired or rate-limited sessions cannot start provider work", async () => {
  for (const mode of ["disabled", "expired", "limited"]) {
    const f = fixture();
    if (mode === "disabled") f.revoke();
    if (mode === "expired") f.granted.expiresAt = 0;
    if (mode === "limited") f.deps.rateLimit = async () => false;
    await assert.rejects(f.service.receipt({ token: "synthetic-token" }));
    assert.deepEqual(f.counts(), { verifyCalls: 0, accepted: 0 });
  }
});
test("revocation or changed session during verification prevents settlement", async () => {
  for (const mode of ["revocation", "session", "configuration"]) {
    const f = fixture();
    f.deps.verify = async (_token, account) => {
      if (mode === "revocation") f.revoke();
      if (mode === "session") f.changeSession();
      if (mode === "configuration") f.granted.version = "changed";
      return { ...storePackReceipt(), account };
    };
    await assert.rejects(f.service.receipt({ token: "synthetic-token" }));
    assert.equal(f.counts().accepted, 0);
  }
});
test("cross-account, altered allocation and real purchases are rejected", async () => {
  for (const mode of ["account", "credits", "real"]) {
    const f = fixture();
    f.deps.verify = async (_token, account) => {
      const r = { ...storePackReceipt(), account };
      if (mode === "account") r.account = "another-member";
      if (mode === "credits") r.product.credits++;
      if (mode === "real")
        (r as { environment: string }).environment = "production";
      return r;
    };
    await assert.rejects(
      f.service.receipt({ token: "synthetic-token" }),
      /does not match/,
    );
    assert.equal(f.counts().accepted, 0);
  }
});
test("provider/SQL failures redact sensitive details and never claim fulfilment", async () => {
  const f = fixture();
  f.deps.verify = async () => {
    throw Error("secret-purchase-token");
  };
  await assert.rejects(
    f.service.receipt({ token: "synthetic-token" }),
    (e) => e instanceof Error && !e.message.includes("secret-purchase-token"),
  );
  const g = fixture();
  g.deps.accept = async () => {
    throw Error("private-sql-content");
  };
  await assert.rejects(
    g.service.receipt({ token: "synthetic-token" }),
    /fulfilment is not confirmed/,
  );
});
