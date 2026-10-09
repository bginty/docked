import { z } from "zod";
import type { MarketReference } from "./market-reference";

export const previewPriceLabel = "DEMO / PREVIEW PRICE" as const;
export const previewPermanentStatement =
  "I understand this creates a permanent PREVIEW test record using fictional prices. It is excluded from real performance, Top Docked, competitions and official results.";
export const previewFixtureIds = ["demo-football", "demo-basketball"] as const;
export const previewReviewInput = z
  .object({
    fixtureId: z.enum(previewFixtureIds),
    selection: z.string().min(1).max(80),
  })
  .strict();
export const previewSubmitInput = z
  .object({
    reviewId: z.string().uuid(),
    reviewToken: z.string().regex(/^[a-f0-9]{64}$/),
    idempotencyKey: z.string().uuid(),
    confirmed: z.literal(true),
  })
  .strict();
export type PreviewMarketReference = Omit<MarketReference, "evidenceMode"> & {
  evidenceMode: "preview";
  fixture: true;
  label: typeof previewPriceLabel;
};
export type PreviewFixtureOption = {
  id: (typeof previewFixtureIds)[number];
  sport: string;
  event: string;
  market: string;
  selections: string[];
  label: typeof previewPriceLabel;
};
export type PreviewReview = {
  id: string;
  fixtureId: PreviewFixtureOption["id"];
  label: typeof previewPriceLabel;
  event: string;
  sport: string;
  market: string;
  selection: string;
  startAt: string;
  observedAt: string;
  expiresAt: string;
  reference: PreviewMarketReference;
  reviewToken: string;
  permanentStatement: typeof previewPermanentStatement;
};
export type PreviewFixtureRecord = {
  id: string;
  submittedAt: string;
  review: PreviewReview;
  label: typeof previewPriceLabel;
  status: "PREVIEW_ONLY";
};
export type PreviewFixtureResponse = {
  status: "READY" | "RESTRICTED";
  label: typeof previewPriceLabel;
  message: string;
  options: PreviewFixtureOption[];
  records: PreviewFixtureRecord[];
};
