export type PrizeStatus =
  | "PROVISIONAL"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "PROCESSING"
  | "FULFILLED"
  | "FAILED"
  | "HELD"
  | "CANCELLED";
export type Obligation = {
  id: string;
  competition: string;
  sport: string;
  round: string;
  position: number;
  member: string;
  displayName: string;
  description: string;
  kind: "cash" | "card" | "pack" | "other";
  quantity: number;
  currency: string | null;
  cents: number | null;
  ruleVersion: string;
  resultRevision: number;
  resultFingerprint: string;
  eligibility: boolean;
  verificationRequired: boolean;
  awardedAt: string;
  dueAt: string;
  operator: string;
  status: PrizeStatus;
  reason: string;
  reference: string | null;
  evidence: string | null;
};
export type PrizeRegister = {
  scope: "synthetic-only";
  obligations: Obligation[];
  audit: {
    actor: string;
    at: string;
    reason: string;
    previous: Obligation | null;
    result: Obligation;
  }[];
};
export function generatePrizes(
  register: PrizeRegister,
  input: {
    competition: string;
    sport: string;
    round: string;
    final: boolean;
    complete: boolean;
    revision: number;
    winners: { member: string; name: string; rank: number }[];
  },
  schedule: {
    version: string;
    approved: boolean;
    tiePolicy: "hold" | "all";
    prizes: {
      position: number;
      description: string;
      kind: Obligation["kind"];
      quantity: number;
      currency: string | null;
      cents: number | null;
      verificationRequired: boolean;
    }[];
  },
  actor: { id: string; owner: boolean; aal: string },
  at: string,
  dueAt: string,
) {
  if (!actor.owner || actor.aal !== "aal2") throw Error("Owner MFA required");
  if (
    register.scope !== "synthetic-only" ||
    !schedule.approved ||
    !input.final ||
    !input.complete
  )
    throw Error("Approved schedule and complete final results required");
  if (
    !Number.isFinite(Date.parse(at)) ||
    !Number.isFinite(Date.parse(dueAt)) ||
    Date.parse(dueAt) < Date.parse(at) ||
    !Number.isInteger(input.revision) ||
    input.revision < 1
  )
    throw Error("Invalid award dates or revision");
  const s = structuredClone(register);
  const fingerprint = JSON.stringify({ results: input, schedule });
  const previous = s.obligations.filter(
    (o) => o.competition === input.competition,
  );
  if (previous.some((o) => o.ruleVersion !== schedule.version))
    throw Error("Existing schedule is immutable; audited adjustment required");
  if (previous.length && previous[0].resultRevision !== input.revision) {
    for (const o of previous) {
      const old = structuredClone(o);
      if (o.status !== "HELD") {
        o.status = "HELD";
        o.reason = `Corrected results revision ${input.revision}: review existing award; no duplicate issuance`;
        s.audit.push({
          actor: actor.id,
          at,
          reason: o.reason,
          previous: old,
          result: structuredClone(o),
        });
      }
    }
    return s;
  }
  if (previous.some((o) => o.resultFingerprint !== fingerprint))
    throw Error(
      "Same result revision changed; new correction revision required",
    );
  if (
    new Set(schedule.prizes.map((p) => p.position)).size !==
    schedule.prizes.length
  )
    throw Error("Duplicate award position");
  for (const prize of schedule.prizes) {
    if (
      !Number.isInteger(prize.quantity) ||
      prize.quantity < 1 ||
      (prize.kind === "cash"
        ? !/^[A-Z]{3}$/.test(prize.currency ?? "") ||
          !Number.isSafeInteger(prize.cents) ||
          prize.cents! <= 0
        : prize.cents !== null || prize.currency !== null)
    )
      throw Error("Explicit prize units required; no invented cash valuation");
    const winners = input.winners.filter((w) => w.rank === prize.position);
    for (const winner of winners) {
      const id = `${input.competition}:${schedule.version}:${prize.position}:${winner.member}`;
      if (s.obligations.some((o) => o.id === id)) continue;
      const o: Obligation = {
        id,
        competition: input.competition,
        sport: input.sport,
        round: input.round,
        position: prize.position,
        member: winner.member,
        displayName: winner.name,
        description: prize.description,
        kind: prize.kind,
        quantity: prize.quantity,
        currency: prize.currency,
        cents: prize.cents,
        ruleVersion: schedule.version,
        resultRevision: input.revision,
        resultFingerprint: fingerprint,
        eligibility: false,
        verificationRequired: prize.verificationRequired,
        awardedAt: at,
        dueAt,
        operator: actor.id,
        status:
          winners.length > 1 && schedule.tiePolicy === "hold"
            ? "HELD"
            : "AWAITING_APPROVAL",
        reason:
          winners.length > 1
            ? "Tied result: apply approved tie policy"
            : "Eligibility review required",
        reference: null,
        evidence: null,
      };
      s.obligations.push(o);
      s.audit.push({
        actor: actor.id,
        at,
        reason: o.reason,
        previous: null,
        result: structuredClone(o),
      });
    }
  }
  return s;
}
export function updatePrize(
  register: PrizeRegister,
  id: string,
  status: PrizeStatus,
  actor: { id: string; owner: boolean; aal: string },
  at: string,
  reason: string,
  confirmation: {
    eligible?: boolean;
    verified?: boolean;
    reference?: string;
    evidence?: string;
  } = {},
) {
  if (!actor.owner || actor.aal !== "aal2" || reason.trim().length < 12)
    throw Error("Owner MFA and audit reason required");
  const s = structuredClone(register),
    o = s.obligations.find((x) => x.id === id);
  if (!o) throw Error("Unknown obligation");
  const transitions: Record<PrizeStatus, PrizeStatus[]> = {
    PROVISIONAL: ["HELD", "CANCELLED"],
    AWAITING_APPROVAL: ["APPROVED", "HELD", "CANCELLED"],
    APPROVED: ["PROCESSING", "HELD", "CANCELLED"],
    PROCESSING: ["FULFILLED", "FAILED", "HELD"],
    FAILED: ["HELD", "PROCESSING", "CANCELLED"],
    HELD: ["AWAITING_APPROVAL", "CANCELLED"],
    FULFILLED: ["HELD"],
    CANCELLED: [],
  };
  if (
    o.reference &&
    s.audit.some(
      (a) => a.result.id === id && a.result.status === "FULFILLED",
    ) &&
    status !== "HELD"
  )
    throw Error(
      "Fulfilled award requires separate audited adjustment; never pay twice",
    );
  if (!transitions[o.status].includes(status))
    throw Error("Invalid prize transition");
  if (
    (status === "APPROVED" || status === "FULFILLED") &&
    (!confirmation.eligible ||
      (o.verificationRequired && !confirmation.verified))
  )
    throw Error("Eligibility and verification required");
  if (
    status === "FULFILLED" &&
    (!confirmation.reference || !confirmation.evidence)
  )
    throw Error("Fulfilment reference and evidence required");
  const old = structuredClone(o);
  o.status = status;
  o.reason = reason;
  o.eligibility = confirmation.eligible ?? o.eligibility;
  o.reference = confirmation.reference ?? o.reference;
  o.evidence = confirmation.evidence ?? o.evidence;
  s.audit.push({
    actor: actor.id,
    at,
    reason,
    previous: old,
    result: structuredClone(o),
  });
  return s;
}
export function prizeTotals(
  register: PrizeRegister,
  now: string,
  start: string,
  end: string,
) {
  const cash: Record<string, number> = {};
  let nonCash = 0,
    overdue = 0,
    fulfilled = 0;
  for (const o of register.obligations) {
    const paid = register.audit.findLast(
      (a) => a.result.id === o.id && a.result.status === "FULFILLED",
    );
    if (paid) {
      if (paid.at >= start && paid.at < end) fulfilled++;
      continue;
    }
    if (o.status === "CANCELLED") continue;
    if (o.kind === "cash")
      cash[o.currency!] = (cash[o.currency!] ?? 0) + o.cents! * o.quantity;
    else nonCash += o.quantity;
    if (o.dueAt < now) overdue++;
  }
  return {
    cashByCurrency: cash,
    nonCashUnits: nonCash,
    overdue,
    fulfilledInRange: fulfilled,
  };
}
