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
  quotes: Quote[];
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
