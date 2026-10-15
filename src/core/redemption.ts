import { z } from "zod";
import { DateTime } from "luxon";
import type { CreditsState } from "./credits-sandbox";
import { creditBalances, wallet } from "./credits-sandbox";
import type { Operator } from "./commerce-sandbox";
import { redemptionRate, audToCredits } from "./redemption-money";
export { redemptionRate, audToCredits, formatAud } from "./redemption-money";

export type IdentityStatus =
  | "NOT_STARTED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MORE_INFORMATION"
  | "VERIFIED"
  | "REJECTED"
  | "REVOKED";
export type RedemptionStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PAYMENT_IN_PROGRESS"
  | "SENT"
  | "REJECTED"
  | "CANCELLED"
  | "EXCEPTION"
  | "RETURNED";
type Event = {
  at: number;
  actor: string;
  status: string;
  reason: string;
  policy: string;
};
export type BankDestination = {
  id: string;
  member: string;
  ciphertext: string;
  last4: string;
  nameMatched: boolean;
  identityRevision: number;
  at: number;
};
export type ManualRedemption = {
  version: 1;
  status: RedemptionStatus;
  rate: typeof redemptionRate;
  audCents: number;
  destination: BankDestination;
  policy: string;
  requestedAt: number;
  approvedAt?: number;
  targetAt?: number | null;
  claimedBy?: string;
  claimedAt?: number;
  sentAt?: number;
  bankReference?: string;
  returnReference?: string;
  journals: string[];
  timeline: Event[];
  internalNotes?: { at: number; actor: string; text: string }[];
};
export type RedemptionProgram = {
  scope: "local-fixtures-only";
  version: string;
  issuancePolicies: string[];
  enabled: boolean;
  realDocumentsEnabled: false;
  minimum: number | null;
  maximum: number | null;
  recentAuthMs: number;
  identityPolicy: string;
  bankPolicy: "exact-normalized-name-fixture";
  calendar: {
    zone: "Australia/Sydney";
    holidays: string[];
    years: number[];
    cutoff: string | null;
    dispatchTime: string | null;
  };
  staff: Record<string, ("identity" | "review" | "payment")[]>;
  identities: Record<
    string,
    {
      status: IdentityStatus;
      revision: number;
      verifiedName: string;
      evidence?: string;
      expires?: number;
      timeline: Event[];
      internalNotes?: { at: number; actor: string; text: string }[];
    }
  >;
  destinations: Record<string, BankDestination>;
  restrictions: Record<string, boolean>;
  access: {
    actor: string;
    reference: string;
    at: number;
    kind: "bank" | "evidence";
  }[];
  notices: {
    id: string;
    member: string;
    type: string;
    reference: string;
    at: number;
  }[];
};
export const redemptionCommand = z
  .object({
    kind: z.literal("redemption"),
    operation: z.discriminatedUnion("action", [
      z
        .object({
          action: z.literal("submit"),
          aud: z.string().max(20),
          destination: z.string().max(100),
          confirmed: z.literal(true),
        })
        .strict(),
      z
        .object({
          action: z.literal("identity-submit"),
          evidence: z.string().regex(/^fixture-evidence-[a-z0-9-]+$/),
        })
        .strict(),
      z
        .object({
          action: z.literal("identity-review"),
          member: z.string(),
          status: z.enum([
            "UNDER_REVIEW",
            "MORE_INFORMATION",
            "VERIFIED",
            "REJECTED",
            "REVOKED",
          ]),
          reason: z.string().min(3).max(240),
          internalNote: z.string().max(1000).optional(),
          expires: z.number().int().optional(),
        })
        .strict(),
      // Ciphertext is prepared by the server vault adapter, never accepted from HTTP.
      z
        .object({
          action: z.literal("bank-save"),
          destination: z
            .object({
              id: z.string(),
              member: z.string(),
              ciphertext: z.string(),
              last4: z.string().regex(/^\d{4}$/),
              nameMatched: z.boolean(),
              identityRevision: z.number().int(),
              at: z.number().int(),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          action: z.enum([
            "review",
            "approve",
            "reject",
            "cancel",
            "claim",
            "sent",
            "exception",
            "release-confirmed-unpaid",
            "return",
          ]),
          withdrawal: z.string().max(100),
          reason: z.string().min(3).max(240),
          internalNote: z.string().max(1000).optional(),
          reference: z.string().max(80).optional(),
          confirmed: z.boolean().optional(),
        })
        .strict(),
      z
        .object({
          action: z.enum(["bank-access", "evidence-access"]),
          reference: z.string(),
        })
        .strict(),
    ]),
  })
  .strict();
export type RedemptionCommand = z.infer<typeof redemptionCommand>;
export function nextBusinessDispatch(
  at: number,
  c: RedemptionProgram["calendar"],
) {
  if (!c.cutoff || !c.dispatchTime) return null;
  const valid = (d: DateTime) => {
    if (!c.years.includes(d.year))
      throw Error("Business calendar coverage unavailable");
    return d.weekday < 6 && !c.holidays.includes(d.toISODate()!);
  };
  let d = DateTime.fromMillis(at, { zone: c.zone });
  const [ch, cm] = c.cutoff.split(":").map(Number);
  const [dh, dm] = c.dispatchTime.split(":").map(Number);
  if (
    ![ch, dh].every((n) => Number.isInteger(n) && n >= 0 && n < 24) ||
    ![cm, dm].every((n) => Number.isInteger(n) && n >= 0 && n < 60)
  )
    throw Error("Invalid calendar policy");
  if (!valid(d) || d.hour * 60 + d.minute >= ch * 60 + cm) {
    do {
      d = d.plus({ days: 1 });
    } while (!valid(d));
  }
  do {
    d = d.plus({ days: 1 });
  } while (!valid(d));
  return d.set({ hour: dh, minute: dm, second: 0, millisecond: 0 }).toMillis();
}
export function redemptionEligible(s: CreditsState, lotId: string) {
  const l = s.lots[lotId],
    p = s.redemption;
  return !!(
    p?.scope === "local-fixtures-only" &&
    l?.cashEligibility?.scope === "local-redemption-fixture" &&
    p.issuancePolicies.includes(l.cashEligibility.policy) &&
    l.redeemable &&
    !["promotional", "purchased"].includes(l.category)
  );
}
export function redemptionBalance(s: CreditsState, member: string) {
  const b = creditBalances(s),
    w = wallet(s, member);
  const eligible = Object.values(s.lots)
    .filter((l) => l.member === member && redemptionEligible(s, l.id))
    .reduce((n, l) => n + (b[`lot:${l.id}:available`] ?? 0), 0);
  const pending = Object.values(s.withdrawals)
    .filter(
      (w) =>
        w.member === member &&
        w.manual &&
        [
          "REQUESTED",
          "UNDER_REVIEW",
          "APPROVED",
          "PAYMENT_IN_PROGRESS",
          "EXCEPTION",
        ].includes(w.manual.status),
    )
    .reduce((n, w) => n + w.amount, 0);
  const available =
    s.redemption?.restrictions[member] || w.heldAvailable ? 0 : eligible;
  return {
    total: w.total,
    available,
    pending,
    other: w.total - available - pending,
    spendable: w.spendable,
  };
}
export function assertRedemptionActor(s: CreditsState, actor: Operator) {
  if (!s.redemption?.enabled || s.redemption.scope !== "local-fixtures-only")
    throw Error("Redemption is disabled. Test credits have no cash value.");
  if (
    actor.role !== "member" &&
    (actor.role !== "reviewer" ||
      actor.aal !== "aal2" ||
      !s.redemption.staff[actor.id]?.length)
  )
    throw Error("Redemption staff permission required");
}
/** Recheck capabilities and recent authentication even when recovering a cached result. */
export function authorizeRedemption(
  s: CreditsState,
  actor: Operator,
  c: RedemptionCommand,
  now: number,
) {
  assertRedemptionActor(s, actor);
  const action = c.operation.action,
    p = s.redemption!;
  const permission = ["identity-review", "evidence-access"].includes(action)
    ? "identity"
    : ["review", "approve", "reject"].includes(action)
      ? "review"
      : [
            "claim",
            "sent",
            "exception",
            "release-confirmed-unpaid",
            "return",
            "bank-access",
          ].includes(action)
        ? "payment"
        : null;
  if (
    permission &&
    (actor.role !== "reviewer" || !p.staff[actor.id]?.includes(permission))
  )
    throw Error("Staff permission required");
  if (!permission && actor.role !== "member")
    throw Error("Member action required");
  if (
    [
      "submit",
      "bank-save",
      "claim",
      "sent",
      "exception",
      "release-confirmed-unpaid",
      "return",
      "bank-access",
    ].includes(action) &&
    (!actor.authenticatedAt ||
      actor.authenticatedAt > now ||
      now - actor.authenticatedAt > p.recentAuthMs)
  )
    throw Error("Please sign in again to confirm this sensitive action.");
  if (c.operation.action === "bank-access") {
    const w = s.withdrawals[c.operation.reference],
      m = w?.manual,
      i = w ? p.identities[w.member] : undefined;
    if (
      !m ||
      m.claimedBy !== actor.id ||
      m.status !== "PAYMENT_IN_PROGRESS" ||
      i?.status !== "VERIFIED" ||
      !i.expires ||
      i.expires <= now ||
      p.restrictions[w.member] ||
      wallet(s, w.member).heldAvailable
    )
      throw Error(
        "Current identity and active payment claim required for bank access",
      );
  }
}
/** Run at complete transaction boundaries, never between paired postings and state updates. */
export function validateRedemption(s: CreditsState) {
  const p = s.redemption;
  if (!p) return;
  if (
    p.scope !== "local-fixtures-only" ||
    p.realDocumentsEnabled !== false ||
    !Number.isSafeInteger(p.recentAuthMs) ||
    p.recentAuthMs <= 0
  )
    throw Error("Redemption boundary");
  for (const n of [p.minimum, p.maximum])
    if (n !== null && (!Number.isSafeInteger(n) || n < 1))
      throw Error("Invalid redemption limits");
  if (p.minimum !== null && p.maximum !== null && p.minimum > p.maximum)
    throw Error("Invalid redemption limits");
  const b = creditBalances(s),
    reserved: Record<string, number> = {};
  for (const w of Object.values(s.withdrawals)) {
    const m = w.manual;
    if (!m) continue;
    if (
      w.status !== m.status ||
      !Number.isSafeInteger(w.amount) ||
      w.amount <= 0 ||
      m.audCents !== w.amount ||
      m.rate.credits !== 1 ||
      m.rate.audCents !== 1 ||
      m.rate.version !== redemptionRate.version ||
      m.destination.member !== w.member ||
      w.parts.reduce((n, x) => n + x.amount, 0) !== w.amount
    )
      throw Error("Redemption snapshot invariant");
    for (const x of w.parts) {
      if (
        s.lots[x.lot]?.member !== w.member ||
        s.lots[x.lot]?.cashEligibility?.scope !== "local-redemption-fixture" ||
        !Number.isSafeInteger(x.amount) ||
        x.amount <= 0
      )
        throw Error("Redemption funding invariant");
      if (
        [
          "REQUESTED",
          "UNDER_REVIEW",
          "APPROVED",
          "PAYMENT_IN_PROGRESS",
          "EXCEPTION",
        ].includes(m.status)
      )
        reserved[x.lot] = (reserved[x.lot] ?? 0) + x.amount;
    }
    if (m.journals.some((j) => !s.journal.some((x) => x.id === j)))
      throw Error("Missing redemption journal");
  }
  for (const [lot, n] of Object.entries(reserved))
    if ((b[`lot:${lot}:reserved`] ?? 0) < n)
      throw Error("Redemption reservation missing");
}
export function applyRedemption(
  s: CreditsState,
  actor: Operator,
  ref: string,
  input: RedemptionCommand,
  now: number,
  post: (
    suffix: string,
    lines: { account: string; credits: number }[],
    reason: string,
  ) => string,
) {
  assertRedemptionActor(s, actor);
  const p = s.redemption!,
    c = input.operation;
  const staff = (permission: "identity" | "review" | "payment") => {
    if (
      actor.role !== "reviewer" ||
      actor.aal !== "aal2" ||
      !p.staff[actor.id]?.includes(permission)
    )
      throw Error("Staff permission and MFA required");
  };
  const fresh = () => {
    if (
      !actor.authenticatedAt ||
      actor.authenticatedAt > now ||
      now - actor.authenticatedAt > p.recentAuthMs
    )
      throw Error("Please sign in again to confirm this sensitive action.");
  };
  const eligibleMember = (member: string) => {
    const i = p.identities[member];
    if (!i || i.status !== "VERIFIED" || !i.expires || i.expires <= now)
      throw Error("Current verified identity required");
    if (p.restrictions[member] || wallet(s, member).heldAvailable)
      throw Error("Account review prevents redemption");
    return i;
  };
  const notify = (member: string, type: string, reference: string) =>
    p.notices.push({
      id: `${actor.id}:${ref}`,
      member,
      type,
      reference,
      at: now,
    });
  const ev = (status: string, reason: string): Event => ({
    at: now,
    actor: actor.id,
    status,
    reason,
    policy: p.version,
  });
  if (c.action === "identity-submit") {
    if (actor.role !== "member") throw Error("Member action required");
    const i = p.identities[actor.id];
    if (
      !i ||
      !["NOT_STARTED", "MORE_INFORMATION", "REJECTED", "REVOKED"].includes(
        i.status,
      )
    )
      throw Error("Identity submission unavailable");
    i.status = "SUBMITTED";
    i.evidence = c.evidence;
    i.revision++;
    i.timeline.push(ev(i.status, "Evidence submitted for review"));
    notify(actor.id, "identity-submitted", ref);
    return { reference: ref };
  }
  if (c.action === "identity-review") {
    staff("identity");
    const i = p.identities[c.member];
    if (!i || !i.evidence) throw Error("Evidence submission required");
    if (
      c.status === "VERIFIED" &&
      (!c.expires ||
        c.expires <= now ||
        !["SUBMITTED", "UNDER_REVIEW", "MORE_INFORMATION"].includes(i.status))
    )
      throw Error("Current evidence review and expiry required");
    if (c.status === "REVOKED" && i.status !== "VERIFIED")
      throw Error("No approval to revoke");
    if (c.status !== "REVOKED" && ["VERIFIED", "REVOKED"].includes(i.status))
      throw Error("Request new evidence before another decision");
    if (c.internalNote)
      i.internalNotes = [
        ...(i.internalNotes ?? []),
        { at: now, actor: actor.id, text: c.internalNote },
      ];
    i.status = c.status;
    i.revision++;
    i.expires = c.expires;
    i.timeline.push(ev(c.status, c.reason));
    notify(c.member, "identity-" + c.status.toLowerCase(), ref);
    return { reference: ref };
  }
  if (c.action === "bank-save") {
    fresh();
    const i = eligibleMember(actor.id),
      d = c.destination;
    if (
      actor.role !== "member" ||
      d.member !== actor.id ||
      d.identityRevision !== i.revision ||
      !d.ciphertext.startsWith("v1:") ||
      p.destinations[d.id]
    )
      throw Error("Verified member name and new bank destination required");
    p.destinations[d.id] = structuredClone(d);
    if (!d.nameMatched) notify(actor.id, "bank-name-review-required", d.id);
    return { reference: d.id };
  }
  if (c.action === "submit") {
    fresh();
    if (actor.role !== "member") throw Error("Member action required");
    const i = eligibleMember(actor.id),
      amount = audToCredits(c.aud),
      d = p.destinations[c.destination];
    if (
      !d ||
      d.member !== actor.id ||
      !d.nameMatched ||
      d.identityRevision !== i.revision
    )
      throw Error("Confirm an eligible bank destination after identity review");
    if (
      (p.minimum !== null && amount < p.minimum) ||
      (p.maximum !== null && amount > p.maximum)
    )
      throw Error("Amount outside configured redemption limits");
    if (s.withdrawals[ref]) throw Error("Request identity already used");
    let remaining = amount;
    const b = creditBalances(s),
      parts: { lot: string; amount: number }[] = [];
    for (const l of Object.values(s.lots)
      .filter((l) => l.member === actor.id && redemptionEligible(s, l.id))
      .sort((a, b) => a.created - b.created || a.id.localeCompare(b.id))) {
      const take = Math.min(remaining, b[`lot:${l.id}:available`] ?? 0);
      if (take) parts.push({ lot: l.id, amount: take });
      remaining -= take;
      if (!remaining) break;
    }
    if (remaining)
      throw Error(
        `Insufficient redeemable credits: ${remaining.toLocaleString("en-AU")} more required.`,
      );
    const journal = post(
      "redemption-reserve",
      parts.flatMap((x) => [
        { account: `lot:${x.lot}:available`, credits: -x.amount },
        { account: `lot:${x.lot}:reserved`, credits: x.amount },
      ]),
      "Manual redemption reserved",
    );
    s.withdrawals[ref] = {
      member: actor.id,
      amount,
      beneficiary: d.id,
      status: "REQUESTED",
      parts,
      manual: {
        version: 1,
        status: "REQUESTED",
        rate: { ...redemptionRate },
        audCents: amount,
        destination: structuredClone(d),
        policy: p.version,
        requestedAt: now,
        journals: [journal],
        timeline: [ev("REQUESTED", "Credits reserved; not paid")],
      },
    };
    notify(actor.id, "redemption-requested", ref);
    return { reference: ref };
  }
  if (c.action === "evidence-access") {
    staff("identity");
    const i = p.identities[c.reference];
    if (!i?.evidence) throw Error("Evidence unavailable");
    p.access.push({
      actor: actor.id,
      reference: c.reference,
      at: now,
      kind: "evidence",
    });
    return { reference: c.reference };
  }
  const reference = "withdrawal" in c ? c.withdrawal : c.reference;
  const w = s.withdrawals[reference],
    m = w?.manual;
  if (!m) throw Error("Request unavailable");
  if (c.action === "bank-access") {
    staff("payment");
    fresh();
    if (m.status !== "PAYMENT_IN_PROGRESS" || m.claimedBy !== actor.id)
      throw Error("Claim this payment before revealing bank details");
    eligibleMember(w.member);
    p.access.push({ actor: actor.id, reference, at: now, kind: "bank" });
    return { reference };
  }
  const prior = m.status;
  const requireState = (states: RedemptionStatus[]) => {
    if (!states.includes(prior))
      throw Error("Request changed or already processed. Refresh its history.");
  };
  const release = () =>
    m.journals.push(
      post(
        "redemption-release",
        w.parts.flatMap((x) => [
          { account: `lot:${x.lot}:reserved`, credits: -x.amount },
          { account: `lot:${x.lot}:available`, credits: x.amount },
        ]),
        "Manual redemption reservation released",
      ),
    );
  if (c.action === "cancel") {
    if (actor.role !== "member" || w.member !== actor.id)
      throw Error("Request unavailable");
    requireState(["REQUESTED", "UNDER_REVIEW", "APPROVED"]);
    release();
    m.status = "CANCELLED";
  } else if (["review", "approve", "reject"].includes(c.action)) {
    staff("review");
    requireState(["REQUESTED", "UNDER_REVIEW"]);
    if (c.action === "approve") {
      eligibleMember(w.member);
      m.status = "APPROVED";
      m.approvedAt = now;
      m.targetAt = nextBusinessDispatch(now, p.calendar);
    } else if (c.action === "reject") {
      release();
      m.status = "REJECTED";
    } else m.status = "UNDER_REVIEW";
  } else {
    staff("payment");
    fresh();
    if (c.action === "claim") {
      requireState(["APPROVED"]);
      eligibleMember(w.member);
      m.claimedBy = actor.id;
      m.claimedAt = now;
      m.status = "PAYMENT_IN_PROGRESS";
    } else if (c.action === "exception") {
      requireState(["PAYMENT_IN_PROGRESS", "EXCEPTION"]);
      m.status = "EXCEPTION";
    } else if (c.action === "release-confirmed-unpaid") {
      requireState(["EXCEPTION"]);
      if (!c.confirmed || !c.reference)
        throw Error("Confirmed unpaid reconciliation evidence required");
      release();
      m.status = "CANCELLED";
    } else if (c.action === "sent") {
      requireState(["PAYMENT_IN_PROGRESS", "EXCEPTION"]);
      if (m.claimedBy !== actor.id || !c.confirmed || !c.reference?.trim())
        throw Error("Claimant confirmation and bank reference required");
      if (
        Object.values(s.withdrawals).some(
          (x) => x.manual?.bankReference === c.reference,
        )
      )
        throw Error("Bank reference already recorded; reconcile");
      m.journals.push(
        post(
          "redemption-sent",
          [
            ...w.parts.map((x) => ({
              account: `lot:${x.lot}:reserved`,
              credits: -x.amount,
            })),
            { account: "system:manual-eft-redeemed", credits: w.amount },
          ],
          "Staff recorded manual EFT sent",
        ),
      );
      m.status = "SENT";
      m.sentAt = now;
      m.bankReference = c.reference;
    } else if (c.action === "return") {
      requireState(["SENT"]);
      if (!c.confirmed || !c.reference)
        throw Error("Confirmed bank return reference required");
      if (
        Object.values(s.withdrawals).some(
          (x) => x.manual?.returnReference === c.reference,
        )
      )
        throw Error("Return already recorded");
      m.journals.push(
        post(
          "redemption-return",
          [
            { account: "system:manual-eft-redeemed", credits: -w.amount },
            ...w.parts.map((x) => ({
              account: `lot:${x.lot}:available`,
              credits: x.amount,
            })),
          ],
          "Confirmed EFT returned; original funding lots restored",
        ),
      );
      m.status = "RETURNED";
      m.returnReference = c.reference;
    } else throw Error("Unsupported redemption transition");
  }
  if ("internalNote" in c && c.internalNote) {
    if (actor.role !== "reviewer")
      throw Error("Staff notes require permission");
    m.internalNotes = [
      ...(m.internalNotes ?? []),
      { at: now, actor: actor.id, text: c.internalNote },
    ];
  }
  w.status = m.status;
  m.timeline.push(ev(m.status, "reason" in c ? c.reason : "Status updated"));
  notify(w.member, "redemption-" + m.status.toLowerCase(), reference);
  return { reference };
}
