import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import {
  executeCredits,
  validateCredits,
  wallet,
  financialReport,
} from "../../src/core/credits-sandbox";
import { redemptionFixture, fixtureBank } from "../fixtures/redemption-state";
import {
  audToCredits,
  formatAud,
  nextBusinessDispatch,
  redemptionBalance,
  validateRedemption,
} from "../../src/core/redemption";
import { redemptionView } from "../../src/core/redemption-view";
import {
  prepareRedemption,
  assertLocalRedemption,
} from "../../src/server/redemption-adapter";
import { RedemptionVault } from "../../src/server/redemption-vault";
import type { Operator } from "../../src/core/commerce-sandbox";
const now = Date.parse("2026-10-15T01:00:00Z");
function harness(ready = true) {
  const f = redemptionFixture(now, ready);
  let s = f.state;
  let n = 0;
  return {
    ...f,
    get s() {
      return s;
    },
    run(
      op: unknown,
      actor: Operator = f.actors.member,
      ref = `operation-${++n}`,
      time = now,
    ) {
      const c = prepareRedemption(s, actor, ref, op, time, f.vault);
      const r = executeCredits(s, actor, ref, c, time);
      s = r.state;
      validateRedemption(s);
      return r.result;
    },
    submit(aud = "100.00", ref = "request") {
      return this.run(
        { action: "submit", aud, destination: f.destination, confirmed: true },
        f.actors.member,
        ref,
      );
    },
  };
}
const step = (h: ReturnType<typeof harness>, action: string, extra = {}) =>
  h.run(
    {
      action,
      withdrawal: "request",
      reason: "Synthetic test decision",
      ...extra,
    },
    h.actors.staff,
  );
test("exact integer cent conversion and malformed amounts", () => {
  assert.equal(audToCredits("1"), 100);
  assert.equal(audToCredits("100.00"), 10000);
  assert.equal(audToCredits("0.01"), 1);
  assert.equal(formatAud(10000), "$100.00 AUD");
  for (const s of ["0", "-1", "1.001", "1e2", "NaN", ".1", "1000000000000"])
    assert.throws(() => audToCredits(s));
});
test("existing test and promotional lots cannot become cash; reservation is a subset", () => {
  const h = harness();
  assert.equal(redemptionBalance(h.s, h.actors.member.id).available, 25000);
  delete h.s.lots["fixture-eligible"].cashEligibility;
  assert.equal(redemptionBalance(h.s, h.actors.member.id).available, 0);
  assert.throws(() => h.submit(), /Insufficient/);
});
test("identity submission requires review; forged rate and eligibility rejected", () => {
  const h = harness(false);
  h.run({
    action: "identity-submit",
    evidence: `fixture-evidence-${h.actors.member.id}`,
  });
  assert.equal(
    h.s.redemption!.identities[h.actors.member.id].status,
    "SUBMITTED",
  );
  assert.throws(() => h.submit(), /verified identity/);
  assert.throws(() =>
    h.run({
      action: "submit",
      aud: "1",
      destination: h.destination,
      confirmed: true,
      rate: 100,
      eligible: true,
    }),
  );
  assert.throws(
    () =>
      h.run({
        action: "identity-review",
        member: h.actors.member.id,
        status: "VERIFIED",
        reason: "Fake",
        expires: now + 100000,
      }),
    /Staff/,
  );
});
test("reserve and duplicate/lost response retry post once; spending sees reduced available", () => {
  const h = harness();
  h.submit();
  const before = structuredClone(h.s);
  h.submit("100.00");
  assert.deepEqual(h.s, before);
  assert.deepEqual(redemptionBalance(h.s, h.actors.member.id), {
    total: 35000,
    available: 15000,
    pending: 10000,
    other: 10000,
    spendable: 25000,
  });
  assert.equal(wallet(h.s, h.actors.member.id).available, 25000);
  assert.throws(() => h.submit("100.01"), /Idempotency/);
  assert.throws(() => h.submit("151.00", "too-much"), /Insufficient/);
});
test("cancel/reject releases exactly once and preserves original eligibility", () => {
  for (const action of ["cancel", "reject"]) {
    const h = harness();
    h.submit();
    h.run(
      { action, withdrawal: "request", reason: "Synthetic cancelled" },
      action === "cancel" ? h.actors.member : h.actors.staff,
      "release",
    );
    const before = structuredClone(h.s);
    h.run(
      { action, withdrawal: "request", reason: "Synthetic cancelled" },
      action === "cancel" ? h.actors.member : h.actors.staff,
      "release",
    );
    assert.deepEqual(h.s, before);
    assert.equal(redemptionBalance(h.s, h.actors.member.id).available, 25000);
    assert.throws(() =>
      h.run(
        { action, withdrawal: "request", reason: "Repeat" },
        action === "cancel" ? h.actors.member : h.actors.staff,
      ),
    );
  }
});
test("claim excludes second staff and cancellation; uncertain outcomes stay reserved", () => {
  const h = harness();
  h.submit();
  step(h, "approve");
  step(h, "claim");
  assert.throws(
    () =>
      h.run(
        { action: "claim", withdrawal: "request", reason: "Other payment" },
        h.actors.staff2,
      ),
    /changed/,
  );
  assert.throws(
    () => h.run({ action: "cancel", withdrawal: "request", reason: "Cancel" }),
    /changed/,
  );
  step(h, "exception");
  assert.equal(redemptionBalance(h.s, h.actors.member.id).pending, 10000);
  assert.equal(financialReport(h.s).pendingWithdrawals, 10000);
  assert.throws(() => step(h, "release-confirmed-unpaid"), /evidence/);
  step(h, "release-confirmed-unpaid", {
    confirmed: true,
    reference: "RECON-UNPAID",
  });
  assert.equal(redemptionBalance(h.s, h.actors.member.id).available, 25000);
});
test("sent consumes reservation only; returned EFT restores original lots once", () => {
  const h = harness();
  h.submit();
  step(h, "approve");
  step(h, "claim");
  step(h, "sent", { confirmed: true, reference: "SYNTHETIC-EFT-1" });
  assert.equal(financialReport(h.s).completedWithdrawals, 10000);
  assert.equal(redemptionBalance(h.s, h.actors.member.id).available, 15000);
  assert.equal(wallet(h.s, h.actors.member.id).total, 25000);
  assert.equal(redemptionBalance(h.s, h.actors.member.id).pending, 0);
  step(h, "return", { confirmed: true, reference: "SYNTHETIC-RETURN-1" });
  assert.equal(redemptionBalance(h.s, h.actors.member.id).available, 25000);
  assert.throws(() =>
    step(h, "return", { confirmed: true, reference: "SYNTHETIC-RETURN-2" }),
  );
  validateCredits(h.s);
});
test("snapshot survives bank change; ciphertext bound to member and destination", () => {
  const h = harness();
  h.submit();
  const original = structuredClone(h.s.withdrawals.request.manual);
  h.run(
    { action: "bank-save", bank: { ...fixtureBank, account: "00112233" } },
    h.actors.member,
    "new-bank",
  );
  assert.deepEqual(h.s.withdrawals.request.manual, original);
  const d = original!.destination;
  assert.equal(h.vault.open(d.ciphertext, d.member, d.id).account, "00001234");
  assert.throws(() => h.vault.open(d.ciphertext, h.actors.other.id, d.id));
  assert.throws(() =>
    new RedemptionVault(Buffer.alloc(32, 8)).open(d.ciphertext, d.member, d.id),
  );
});
test("private projections omit ciphertext, full bank details and other members", () => {
  const h = harness();
  h.submit();
  const view = JSON.stringify(redemptionView(h.s, h.actors.member));
  for (const secret of [
    fixtureBank.bsb,
    fixtureBank.account,
    fixtureBank.holder,
    "ciphertext",
  ])
    assert.ok(!view.includes(secret));
  assert.equal(redemptionView(h.s, h.actors.other).requests.length, 0);
  assert.throws(() => redemptionView(h.s, h.actors.member, true));
  assert.throws(
    () =>
      h.run(
        { action: "cancel", withdrawal: "request", reason: "Wrong owner" },
        h.actors.other,
      ),
    /unavailable/,
  );
  assert.throws(
    () => h.run({ action: "bank-access", reference: "request" }),
    /Staff/,
  );
});
test("revoked identity, restrictions and expired authentication fail closed, including retries", () => {
  const h = harness();
  h.submit();
  assert.throws(
    () =>
      h.run(
        {
          action: "submit",
          aud: "100.00",
          destination: h.destination,
          confirmed: true,
        },
        { ...h.actors.member, authenticatedAt: now - 3600000 },
        "request",
      ),
    /sign in/,
  );
  h.s.redemption!.restrictions[h.actors.member.id] = true;
  const b = redemptionBalance(h.s, h.actors.member.id);
  assert.equal(b.available + b.pending + b.other, b.total);
  assert.throws(() => h.submit("1", "restricted"), /Account review/);
  h.s.redemption!.restrictions[h.actors.member.id] = false;
  h.run(
    {
      action: "identity-review",
      member: h.actors.member.id,
      status: "REVOKED",
      reason: "Synthetic revocation",
    },
    h.actors.staff,
  );
  assert.throws(() => step(h, "approve"), /verified identity/);
});
test("limits, mismatched bank holder, unsafe documents and live environments rejected", () => {
  const h = harness();
  h.s.redemption!.minimum = 200;
  h.s.redemption!.maximum = 300;
  assert.throws(() => h.submit("1"), /limits/);
  assert.throws(() => h.submit("4"), /limits/);
  h.run(
    { action: "bank-save", bank: { ...fixtureBank, holder: "Wrong Owner" } },
    h.actors.member,
    "mismatch-bank",
  );
  assert.equal(
    h.s.redemption!.destinations["mismatch-bank"].nameMatched,
    false,
  );
  assert.throws(
    () =>
      h.run({
        action: "submit",
        aud: "2.00",
        destination: "mismatch-bank",
        confirmed: true,
      }),
    /eligible bank/,
  );
  assert.throws(() =>
    h.run({ action: "identity-submit", evidence: "https://public-document" }),
  );
  for (const env of [
    {},
    { DOCKED_REDEMPTION_LOCAL: "true", NODE_ENV: "production" },
    {
      DOCKED_REDEMPTION_LOCAL: "true",
      DATABASE_URL: "postgres://remote/production",
    },
  ])
    assert.throws(() => assertLocalRedemption(env));
});
test("business target: weekends, holidays, after cutoff, Sydney DST and absent policy", () => {
  const c = {
    zone: "Australia/Sydney" as const,
    years: [2026],
    holidays: ["2026-10-05"],
    cutoff: "15:00",
    dispatchTime: "17:00",
  };
  const at = (s: string) => DateTime.fromISO(s, { zone: c.zone }).toMillis();
  assert.equal(
    nextBusinessDispatch(at("2026-10-02T14:00"), c),
    at("2026-10-06T17:00"),
  );
  assert.equal(
    nextBusinessDispatch(at("2026-10-02T16:00"), c),
    at("2026-10-07T17:00"),
  );
  assert.equal(nextBusinessDispatch(now, { ...c, cutoff: null }), null);
  assert.throws(
    () => nextBusinessDispatch(at("2026-12-31T14:00"), c),
    /coverage/,
  );
});
test("cached bank access rechecks revocation and staff permission; legacy payout cannot bypass workflow", () => {
  const h = harness();
  h.submit();
  step(h, "approve");
  step(h, "claim");
  const op = { action: "bank-access", reference: "request" };
  h.run(op, h.actors.staff, "bank-reveal");
  h.s.redemption!.staff[h.actors.staff.id] = ["identity"];
  assert.throws(() => h.run(op, h.actors.staff, "bank-reveal"), /Staff/);
  h.s.redemption!.staff[h.actors.staff.id] = ["identity", "review", "payment"];
  h.run(
    {
      action: "identity-review",
      member: h.actors.member.id,
      status: "REVOKED",
      reason: "New risk review",
    },
    h.actors.staff,
  );
  assert.throws(
    () => h.run(op, h.actors.staff, "bank-reveal"),
    /Current identity/,
  );
  assert.throws(
    () =>
      executeCredits(
        h.s,
        h.actors.staff,
        "legacy-bypass",
        {
          kind: "payout-submit",
          withdrawal: "request",
          provider: "legacy-provider",
        },
        now,
      ),
    /redemption workflow/,
  );
});
test("internal staff notes never appear in customer history or notification records", () => {
  const h = harness();
  h.submit();
  step(h, "approve", { internalNote: "Private review detail fixture" });
  assert.ok(
    !JSON.stringify(redemptionView(h.s, h.actors.member)).includes(
      "Private review detail fixture",
    ),
  );
  assert.ok(
    JSON.stringify(redemptionView(h.s, h.actors.staff, true)).includes(
      "Private review detail fixture",
    ),
  );
  assert.ok(
    !JSON.stringify(h.s.redemption!.notices).includes(
      "Private review detail fixture",
    ),
  );
});
test("future policy version does not rewrite a saved obligation, rate or eligibility classification", () => {
  const h = harness();
  h.submit();
  const original = structuredClone(h.s.withdrawals.request.manual!);
  h.s.redemption!.version = "future-fixture-policy-v2";
  h.s.redemption!.maximum = 50;
  step(h, "approve");
  step(h, "claim");
  step(h, "sent", { confirmed: true, reference: "HISTORICAL-RATE-EFT" });
  const current = h.s.withdrawals.request.manual!;
  assert.deepEqual(current.rate, original.rate);
  assert.equal(current.audCents, original.audCents);
  assert.equal(current.policy, original.policy);
  step(h, "return", { confirmed: true, reference: "HISTORICAL-RATE-RETURN" });
  assert.equal(redemptionBalance(h.s, h.actors.member.id).available, 25000);
});
