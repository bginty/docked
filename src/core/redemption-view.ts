import type { CreditsState } from "./credits-sandbox";
import { redemptionBalance } from "./redemption";
import type { Operator } from "./commerce-sandbox";

export function redemptionView(
  s: CreditsState,
  actor: Operator,
  admin = false,
  now = Date.now(),
) {
  const p = s.redemption,
    permissions =
      actor.role === "reviewer" && actor.aal === "aal2"
        ? (p?.staff[actor.id] ?? [])
        : [];
  if (admin && !permissions.length) throw Error("Staff access required");
  const permitted = (member: string) =>
    (admin &&
      (permissions.includes("review") || permissions.includes("payment"))) ||
    member === actor.id;
  const identity = p?.identities[actor.id];
  return {
    enabled: !!p?.enabled,
    fixtureOnly: true,
    member: actor.id,
    admin,
    permissions,
    balance: redemptionBalance(s, actor.id),
    identity: identity?.status ?? "NOT_STARTED",
    identityTimeline:
      identity?.timeline.map((e) => ({
        at: e.at,
        status: e.status,
        reason: e.reason,
      })) ?? [],
    identityExpires: identity?.expires,
    completedOperations: Object.entries(s.requests)
      .filter(
        ([key]) =>
          key.startsWith(actor.id + ":") &&
          s.events.some((e) => e.id === key && e.kind === "redemption"),
      )
      .map(([key]) => key.slice(actor.id.length + 1))
      .slice(-200),
    identityPolicy: p?.identityPolicy ?? "Not configured",
    calendarConfigured: !!p?.calendar.cutoff && !!p?.calendar.dispatchTime,
    limits: { minimum: p?.minimum ?? null, maximum: p?.maximum ?? null },
    destinations: Object.values(p?.destinations ?? {})
      .filter((d) => d.member === actor.id)
      .map((d) => ({
        id: d.id,
        last4: d.last4,
        nameMatched: d.nameMatched,
        eligible:
          d.nameMatched &&
          identity?.status === "VERIFIED" &&
          identity.expires! > now &&
          identity.revision === d.identityRevision,
      })),
    identities:
      admin && permissions.includes("identity")
        ? Object.entries(p?.identities ?? {}).map(([member, i]) => ({
            member,
            memberLabel: i.verifiedName,
            status: i.status,
            revision: i.revision,
            evidence: !!i.evidence,
            timeline: i.timeline,
            internalNotes: i.internalNotes ?? [],
          }))
        : [],
    destinationExceptions: admin
      ? Object.values(p?.destinations ?? {})
          .filter((d) => !d.nameMatched)
          .map((d) => ({
            id: d.id,
            member: d.member,
            memberLabel: p?.identities[d.member]?.verifiedName,
            last4: d.last4,
            at: d.at,
          }))
      : [],
    requests: Object.entries(s.withdrawals)
      .filter(([, w]) => w.manual && permitted(w.member))
      .map(([id, w]) => {
        const m = w.manual!;
        return {
          id,
          member: admin ? w.member : undefined,
          memberLabel: admin
            ? p?.identities[w.member]?.verifiedName
            : undefined,
          credits: w.amount,
          audCents: m.audCents,
          rate: m.rate,
          status: m.status,
          last4: m.destination.last4,
          requestedAt: m.requestedAt,
          approvedAt: m.approvedAt,
          targetAt: m.targetAt,
          claimedBy: admin ? m.claimedBy : undefined,
          requestedAgeMs: now - m.requestedAt,
          approvalAgeMs: m.approvedAt ? now - m.approvedAt : null,
          identityStatus: p?.identities[w.member]?.status ?? "NOT_STARTED",
          reference: m.bankReference,
          returnReference: m.returnReference,
          internalNotes: admin ? (m.internalNotes ?? []) : [],
          journals: m.journals,
          timeline: m.timeline.map((e) => ({
            at: e.at,
            status: e.status,
            reason: e.reason,
          })),
          cancellable: ["REQUESTED", "UNDER_REVIEW", "APPROVED"].includes(
            m.status,
          ),
        };
      })
      .sort((a, b) => b.requestedAt - a.requestedAt),
    notices: (p?.notices ?? [])
      .filter((n) => n.member === actor.id)
      .map(({ id, type, reference, at }) => ({ id, type, reference, at })),
  };
}
export type RedemptionView = ReturnType<typeof redemptionView>;
