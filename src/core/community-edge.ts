import Decimal from "decimal.js";
import type { Rules } from "./pricing";

export const communityRuleV1 = Object.freeze({
  version: "community-standard-v1",
  standardUnits: "1.00",
  cutoffSeconds: 600,
  maxAgeSeconds: 180,
  maxOdds: "1000",
});
export const permanentEdgeStatement =
  "PERMANENT RECORD — Once submitted, this Edge becomes part of your Docked performance record and cannot be deleted or edited.";
export const priceClasses = [
  "STANDARD_VERIFIED",
  "PROMOTIONAL_EXCLUDED",
  "UNVERIFIED",
  "STALE",
  "MARKET_MISMATCH",
  "UNSUPPORTED",
  "POST_CUTOFF",
  "UNKNOWN_REVIEW",
] as const;
export type PriceClass = (typeof priceClasses)[number];
export type CommunityResult =
  "PENDING" | "WON" | "LOST" | "VOID" | "DISPUTED" | "MANUAL_REVIEW";
export type CommunityQuoteOption = {
  snapshotId: string;
  marketId: string;
  sport: string;
  competition: string;
  eventId: string;
  eventLabel: string;
  startAt: string;
  selection: string;
  bookmaker: string;
  odds: string;
  sourceAt: string;
  receivedAt: string;
  cutoffAt: string;
  classification: PriceClass;
  ruleVersion: string;
};
export type CommunityReview = CommunityQuoteOption & {
  reviewToken: string;
  permanentStatement: string;
};
export type CommunityEdge = CommunityQuoteOption & {
  id: string;
  profileId: string;
  handle: string;
  displayName: string;
  submittedAt: string;
  units: "1.00";
  result: CommunityResult;
  settledAt: string | null;
  corrections: number;
  integrity: "CLEAR" | "REVIEW";
  interactionsAllowed: boolean;
};
export type QuoteOptionsResponse = {
  status: "NOT_CONFIGURED" | "RESTRICTED" | "NO_VERIFIED_PRICES" | "READY";
  message: string;
  options: CommunityQuoteOption[];
};
/** Private provider evidence is never accepted from a member request. */
export type CommunityQuoteEvidence = CommunityQuoteOption & {
  provider: string;
  providerEventId: string;
  snapshotAt: string;
  rules: Rules;
  canonicalRules: Rules;
  observedStartAt: string;
  prices: Record<string, string>;
  suspended: boolean;
  eventStatus: string;
  provenance: "docked_current_provider" | "historical" | "demo" | "unknown";
  licensed: boolean;
  providerClassification: PriceClass | null;
  classificationEvidence: string | null;
  classificationVersion: string | null;
  promotionFlags: string[];
  ordinaryAccountLimits?: boolean;
};
const supportedCompetitions: Record<string, string> = {
  soccer_epl: "football_1x2",
  soccer_spain_la_liga: "football_1x2",
  basketball_nba: "nba_moneyline",
};
function validInstant(value: string) {
  return (
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
  );
}
export function matchingCommunityRules(a: Rules, b: Rules) {
  return (
    a.eventId === b.eventId &&
    a.competition === b.competition &&
    a.market === b.market &&
    a.period === b.period &&
    a.overtime === b.overtime &&
    a.draw === b.draw &&
    a.line === b.line &&
    a.settlement === b.settlement &&
    [...a.participants].sort().join("\0") ===
      [...b.participants].sort().join("\0") &&
    [...a.outcomes].sort().join("\0") === [...b.outcomes].sort().join("\0")
  );
}
export function verifyCommunityQuote(
  e: CommunityQuoteEvidence,
  context: {
    now: string;
    regionAllowed: boolean;
    bookmakerAllowed: boolean;
    feedHealthy: boolean;
  },
): { eligible: boolean; classification: PriceClass; reason: string } {
  const reject = (classification: PriceClass, reason: string) => ({
    eligible: false,
    classification,
    reason,
  });
  if (!context.regionAllowed || !context.bookmakerAllowed)
    return reject("UNVERIFIED", "Regional or bookmaker approval is missing.");
  if (
    !context.feedHealthy ||
    !e.licensed ||
    e.provenance !== "docked_current_provider" ||
    !e.provider ||
    !e.providerEventId
  )
    return reject(
      "UNVERIFIED",
      "Licensed current Docked-received provider evidence is required.",
    );
  if (
    ![
      context.now,
      e.sourceAt,
      e.snapshotAt,
      e.receivedAt,
      e.startAt,
      e.observedStartAt,
    ].every(validInstant)
  )
    return reject("UNVERIFIED", "Timestamp evidence is missing or invalid.");
  const now = Date.parse(context.now),
    source = Date.parse(e.sourceAt),
    snapshot = Date.parse(e.snapshotAt),
    received = Date.parse(e.receivedAt),
    start = Date.parse(e.startAt);
  if (
    start !== Date.parse(e.observedStartAt) ||
    e.eventId !== e.rules.eventId ||
    e.competition !== e.rules.competition ||
    !matchingCommunityRules(e.rules, e.canonicalRules)
  )
    return reject(
      "MARKET_MISMATCH",
      "Event, commencement time or market rules do not match.",
    );
  if (
    e.sport !==
      (e.competition === "basketball_nba" ? "basketball" : "football") ||
    e.rules.participants.length !== 2 ||
    new Set(e.rules.participants).size !== 2 ||
    new Set(e.rules.outcomes).size !== e.rules.outcomes.length ||
    [...e.rules.outcomes].sort().join("\0") !==
      [
        ...e.rules.participants,
        ...(e.rules.market === "football_1x2" ? ["Draw"] : []),
      ]
        .sort()
        .join("\0")
  )
    return reject(
      "MARKET_MISMATCH",
      "Sport or complete outcome mapping does not match the supported competition.",
    );
  if (
    now >= start - communityRuleV1.cutoffSeconds * 1000 ||
    e.eventStatus !== "scheduled"
  )
    return reject("POST_CUTOFF", "Edge submissions are closed for this event.");
  if (
    source > snapshot ||
    snapshot > received ||
    received > now ||
    now - source > communityRuleV1.maxAgeSeconds * 1000 ||
    now - received > communityRuleV1.maxAgeSeconds * 1000
  )
    return reject(
      "STALE",
      "The provider quote is stale or its timestamp ordering is invalid.",
    );
  if (
    supportedCompetitions[e.competition] !== e.rules.market ||
    e.rules.period !== "full_game" ||
    e.rules.line !== null ||
    (e.rules.market === "football_1x2"
      ? e.rules.overtime ||
        !e.rules.draw ||
        e.rules.settlement !== "regulation_90_plus_stoppage"
      : !e.rules.overtime ||
        e.rules.draw ||
        e.rules.settlement !== "full_game_including_overtime")
  )
    return reject(
      "UNSUPPORTED",
      "This settlement contract is not supported for verified community records.",
    );
  if (
    e.suspended ||
    !e.rules.outcomes.includes(e.selection) ||
    Object.keys(e.prices).sort().join("\0") !==
      [...e.rules.outcomes].sort().join("\0")
  )
    return reject(
      "MARKET_MISMATCH",
      "The market is suspended, incomplete or the selection is not mapped.",
    );
  try {
    if (
      !e.rules.outcomes.every((selection) => {
        const n = new Decimal(e.prices[selection]);
        return n.isFinite() && n.gt(1) && n.lte(communityRuleV1.maxOdds);
      }) ||
      !new Decimal(e.odds).eq(e.prices[e.selection])
    )
      return reject(
        "UNVERIFIED",
        "The selected price must equal the observed provider price.",
      );
  } catch {
    return reject("UNVERIFIED", "A valid observed decimal price is required.");
  }
  if (
    e.promotionFlags.length ||
    e.providerClassification === "PROMOTIONAL_EXCLUDED"
  )
    return reject(
      "PROMOTIONAL_EXCLUDED",
      "Promotional prices are social-only and excluded from performance.",
    );
  if (
    !e.classificationEvidence?.trim() ||
    !e.classificationVersion?.trim() ||
    e.providerClassification === null ||
    e.providerClassification === "UNKNOWN_REVIEW"
  )
    return reject(
      "UNKNOWN_REVIEW",
      "Standard-price classification has not been established by the provider evidence.",
    );
  if (e.providerClassification !== "STANDARD_VERIFIED")
    return reject(
      e.providerClassification,
      "The quote is not a verified standard-market price.",
    );
  // Ordinary account or market limits do not, by themselves, make a standard quote promotional.
  return {
    eligible: true,
    classification: "STANDARD_VERIFIED",
    reason:
      "Verified standard price; availability is not a guarantee of execution.",
  };
}
