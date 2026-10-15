import { digest } from "../../src/core/scoring-engine";
import {
  initialCredits,
  validateCredits,
  executeCredits,
} from "../../src/core/credits-sandbox";
import { newCreditOnly } from "../../src/core/credit-only";
import { RedemptionVault } from "../../src/server/redemption-vault";
import { prepareRedemption } from "../../src/server/redemption-adapter";
export const redemptionActors = (now = Date.now()) => ({
  member: {
    id: "00000000-0000-4000-8000-000000000001",
    role: "member" as const,
    authenticatedAt: now,
  },
  other: {
    id: "00000000-0000-4000-8000-000000000002",
    role: "member" as const,
    authenticatedAt: now,
  },
  staff: {
    id: "00000000-0000-4000-8000-000000000003",
    role: "reviewer" as const,
    aal: "aal2" as const,
    authenticatedAt: now,
  },
  staff2: {
    id: "00000000-0000-4000-8000-000000000004",
    role: "reviewer" as const,
    aal: "aal2" as const,
    authenticatedAt: now,
  },
});
export const fixtureBank = {
  holder: "Alex Example",
  bsb: "001234",
  account: "00001234",
};
/** Synthetic ledger seed. No production import, member grant or real cash backing. */
export function redemptionFixture(now = Date.now(), ready = true) {
  let s = initialCredits();
  s.creditOnly = newCreditOnly();
  const a = redemptionActors(now),
    vault = new RedemptionVault(Buffer.alloc(32, 7));
  s.redemption = {
    scope: "local-fixtures-only",
    version: "synthetic-redemption-v1",
    issuancePolicies:["synthetic-redemption-v1"],
    enabled: true,
    realDocumentsEnabled: false,
    minimum: null,
    maximum: null,
    recentAuthMs: 15 * 60000,
    identityPolicy: "synthetic-evidence-v1",
    bankPolicy: "exact-normalized-name-fixture",
    calendar: {
      zone: "Australia/Sydney",
      holidays: ["2026-12-25", "2026-12-28"],
      years: [2026, 2027],
      cutoff: null,
      dispatchTime: null,
    },
    staff: {
      [a.staff.id]: ["identity", "review", "payment"],
      [a.staff2.id]: ["payment"],
    },
    identities: {
      [a.member.id]: {
        status: "NOT_STARTED",
        revision: 0,
        verifiedName: fixtureBank.holder,
        timeline: [],
      },
      [a.other.id]: {
        status: "NOT_STARTED",
        revision: 0,
        verifiedName: "Jordan Example",
        timeline: [],
      },
    },
    destinations: {},
    restrictions: {},
    access: [],
    notices: [],
  };
  for (const [id, amount, eligible] of [
    ["fixture-eligible", 25000, true],
    ["fixture-test", 10000, false],
  ] as const) {
    s.lots[id] = {
      id,
      member: a.member.id,
      category: eligible ? "competition" : "promotional",
      redeemable: eligible,
      provenance: "isolated-fixture",
      created: now,
      ...(eligible
        ? {
            cashEligibility: {
              scope: "local-redemption-fixture" as const,
              policy: s.redemption.version,
            },
          }
        : {}),
    };
    const body = {
      id: `seed-${id}`,
      at: now,
      actor: "fixture",
      reason: "Synthetic local seed; no cash backing",
      policy: s.policy.version,
      lines: [
        { account: `lot:${id}:available`, credits: amount },
        { account: "system:fixture-seed", credits: -amount },
      ],
      previousHash: s.journal.at(-1)?.hash ?? "GENESIS",
    };
    s.journal.push({ ...body, hash: digest(body) });
  }
  validateCredits(s);
  const run = (
    actor: typeof a.member | typeof a.staff,
    ref: string,
    op: unknown,
  ) => {
    s = executeCredits(
      s,
      actor,
      ref,
      prepareRedemption(s, actor, ref, op, now, vault),
      now,
    ).state;
  };
  if (ready) {
    run(a.member, "fixture-evidence", {
      action: "identity-submit",
      evidence: `fixture-evidence-${a.member.id}`,
    });
    run(a.staff, "fixture-verify", {
      action: "identity-review",
      member: a.member.id,
      status: "VERIFIED",
      reason: "Synthetic evidence reviewed",
      expires: now + 86400000,
    });
    run(a.member, "00000000-0000-4000-8000-000000000010", {
      action: "bank-save",
      bank: fixtureBank,
    });
  }
  return {
    state: s,
    actors: a,
    vault,
    destination: "00000000-0000-4000-8000-000000000010",
  };
}
