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
export interface OddsProvider {
  id: string;
  capabilities: Capabilities;
  fetch(
    sport: string,
    asOf?: string,
  ): Promise<{
    raw: unknown;
    quotes: Quote[];
    remaining: number;
    used: number;
    receivedAt: string;
  }>;
}
export interface ResultsProvider {
  id: string;
  authorised: boolean;
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
  async result() {
    return null;
  }
}
