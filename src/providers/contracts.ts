import type { Quote, Rules } from "@/core/pricing";
import type { Result } from "@/core/settlement";
export type Capabilities = {
  current: boolean;
  historical: boolean;
  results: boolean;
  sourceTimestamps: boolean;
  marketRules: boolean;
  liquidity: boolean;
  limits: boolean;
  commission: boolean;
  retention: boolean;
  display: boolean;
  export: boolean;
};
export type ProviderStatus = "NOT_CONFIGURED" | "DISABLED" | "READY";
/** Trusted adapter output, never accepted from member input or inferred from an h2h market label. */
export type CommunityProviderMetadata = {
  sourceKind: "current_provider";
  /** Separate instrument identity; absent legacy metadata cannot enter a new MarketReference. */
  sourceType?: "bookmaker" | "exchange";
  receivedByDocked: true;
  providerEventId: string;
  observedStartAt: string;
  priceClass: "STANDARD_VERIFIED" | "PROMOTIONAL_EXCLUDED" | "UNKNOWN_REVIEW";
  classificationVersion: string;
  classificationEvidence: string;
  promotionFlags: string[];
};
export type ProviderQuote = Quote & {
  communityMetadata?: CommunityProviderMetadata;
  sourceTimestampKind?:
    "market_observation" | "bookmaker_legacy" | "price_change";
};
export type OddsDiagnostics = {
  eventsReceived: number;
  marketsReceived: number;
  validMarkets: number;
  rejectedMarkets: number;
  staleMarkets: number;
  mappingFailures: number;
  sourceTimestampAgeSeconds: number | null;
  errors: string[];
};
export type OddsFetchResult = {
  raw: unknown;
  quotes: ProviderQuote[];
  remaining: number | null;
  used: number | null;
  lastRequestCost: number | null;
  receivedAt: string;
  snapshotAt: string;
  historicalSnapshotId: string | null;
  stats: OddsDiagnostics;
};
export interface OddsProvider {
  id: string;
  status: ProviderStatus;
  capabilities: Capabilities;
  fetch(sport: string, asOf?: string): Promise<OddsFetchResult>;
}
export interface ResultsProvider {
  id: string;
  authorised: boolean;
  status: ProviderStatus;
  result(eventId: string, rules: Rules): Promise<Result | null>;
}
export interface EmailProvider {
  send(message: {
    to: string;
    subject: string;
    text: string;
    unsubscribeUrl: string;
    idempotencyKey: string;
  }): Promise<{ id: string }>;
}
export interface NotificationProvider {
  channel: string;
  deliver(
    userId: string,
    payload: unknown,
    key: string,
  ): Promise<{ id: string }>;
}
export class PendingResultsProvider implements ResultsProvider {
  id = "pending-authorised-results";
  authorised = false;
  status = "NOT_CONFIGURED" as const;
  async result() {
    return null;
  }
}
