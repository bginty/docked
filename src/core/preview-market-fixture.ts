import {
  buildMarketReference,
  marketReferenceV1,
  type MarketSourceObservation,
} from "./market-reference";
import { hash, type Rules } from "./pricing";
import {
  previewPriceLabel,
  previewPermanentStatement,
  previewReviewInput,
  type PreviewFixtureOption,
  type PreviewReview,
} from "./preview-market-contracts";

/** Authored synthetic catalogue. Never provider events or actionable live prices. */
export const previewFixtureOptions: readonly PreviewFixtureOption[] =
  Object.freeze([
    {
      id: "demo-football",
      sport: "football",
      event: "DEMO Harbour FC v DEMO Bay FC",
      market: "DEMO regulation result",
      selections: ["DEMO Harbour FC", "Draw", "DEMO Bay FC"],
      label: previewPriceLabel,
    },
    {
      id: "demo-basketball",
      sport: "basketball",
      event: "DEMO Harbour Hoops v DEMO Bay Hoops",
      market: "DEMO full game including overtime",
      selections: ["DEMO Harbour Hoops", "DEMO Bay Hoops"],
      label: previewPriceLabel,
    },
  ]);

export function buildPreviewFixture(
  input: unknown,
  id: string,
  observedAt: string,
) {
  const parsed = previewReviewInput.parse(input);
  if (!/^[a-f0-9-]{36}$/.test(id) || !Number.isFinite(Date.parse(observedAt)))
    throw new Error("Valid preview review identity and time required");
  const option = previewFixtureOptions.find((o) => o.id === parsed.fixtureId)!;
  if (!option.selections.includes(parsed.selection))
    throw new Error("Unknown DEMO selection");
  const football = option.sport === "football";
  const startAt = new Date(Date.parse(observedAt) + 7200000).toISOString();
  const rules: Rules = {
    eventId: `preview:${id}`,
    competition: football ? "soccer_epl" : "basketball_nba",
    participants: option.selections.filter((s) => s !== "Draw"),
    outcomes: option.selections,
    market: football ? "football_1x2" : "nba_moneyline",
    period: "full_game",
    line: null,
    overtime: !football,
    draw: football,
    settlement: football
      ? "regulation_90_plus_stoppage"
      : "full_game_including_overtime",
  };
  const configuration = {
    ...marketReferenceV1,
    version: "market-reference-v1.0.0-preview-fixture",
    pricingBookmakers: ["DEMO-P1", "DEMO-P2"],
    availabilityBookmakers: ["DEMO-A1", "DEMO-A2"],
  };
  const sources: MarketSourceObservation[] = [
    "DEMO-P1",
    "DEMO-P2",
    "DEMO-A1",
    "DEMO-A2",
  ].map((bookmaker, index) => {
    const prices = football
      ? index < 2
        ? ["2.00", "3.40", "4.00"]
        : [index === 2 ? "2.08" : "2.10", "3.30", "3.50"]
      : index < 2
        ? ["1.90", "1.90"]
        : [index === 2 ? "2.00" : "2.02", "1.84"];
    return {
      id: `${id}:${bookmaker}`,
      bookmaker,
      operator: `DEMO-operator-${index}`,
      rules,
      prices: Object.fromEntries(
        option.selections.map((s, i) => [s, prices[i]]),
      ),
      sourceAt: observedAt,
      snapshotAt: observedAt,
      receivedAt: observedAt,
      provider: "authored-preview-fixture",
      sourceKind: "bookmaker",
      provenance: "fixture",
      approved: true,
      licensed: true,
      mappingVerified: true,
      feedHealthy: true,
      suspended: false,
      rightsReference:
        "DEMO synthetic arithmetic only; no external provider data or rights asserted",
      ownershipEvidence:
        "DEMO independent source identities for software testing only",
      priceClass: "STANDARD_VERIFIED",
      classificationVersion: "DEMO-classification-v1",
      classificationEvidence:
        "DEMO synthetic standard-price scenario, not real provider verification",
      promotionFlags: [],
    };
  });
  // Existing research mode explicitly accepts fixture provenance. Current mode
  // rejects these same sources. The result is immediately branded PREVIEW and
  // cannot be used as a current/research MarketReference or stored in its tables.
  const result = buildMarketReference(
    {
      rules,
      startAt,
      observedAt,
      selection: parsed.selection,
      sources,
      evidenceMode: "research",
    },
    configuration,
  );
  if (result.status !== "READY")
    throw new Error("DEMO reference calculation unavailable");
  const payload = {
    fixture: true as const,
    evidenceMode: "preview" as const,
    label: previewPriceLabel,
    fixtureId: option.id,
    event: option.event,
    sport: option.sport,
    market: option.market,
    selection: parsed.selection,
    startAt,
    observedAt,
    expiresAt: new Date(Date.parse(observedAt) + 90000).toISOString(),
    configuration,
    rules,
    sources,
    reference: {
      ...result.reference,
      evidenceMode: "preview" as const,
      fixture: true as const,
      label: previewPriceLabel,
    },
  };
  const review: PreviewReview = {
    id,
    fixtureId: option.id,
    label: previewPriceLabel,
    event: option.event,
    sport: option.sport,
    market: option.market,
    selection: parsed.selection,
    startAt,
    observedAt,
    expiresAt: payload.expiresAt,
    reference: payload.reference,
    reviewToken: hash(payload),
    permanentStatement: previewPermanentStatement,
  };
  return { payload, review };
}

export function assertPreviewReviewFresh(review: PreviewReview, now: number) {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(Date.parse(review.expiresAt)) ||
    now < Date.parse(review.observedAt) ||
    now >= Date.parse(review.expiresAt) ||
    review.reference.evidenceMode !== "preview" ||
    review.reference.fixture !== true ||
    review.label !== previewPriceLabel
  )
    throw new Error("PREVIEW review expired; review and confirm again");
}
