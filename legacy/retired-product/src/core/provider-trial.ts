import { createHash } from "node:crypto";
import { z } from "zod";
import manifest from "../../config/hosted-preview.json";
import { marketDataPreviewIdentity } from "./market-data-environment";
export const trialRequestSchema = z.object({ permitId: z.uuid() }).strict();
export const trialTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function trialMappingAccepted(rejected: number) {
  return Number.isSafeInteger(rejected) && rejected === 0;
}
/** Manual authority never enables a scheduled provider or model. */
export function providerTrialEnvironment(
  env: Record<string, string | undefined>,
) {
  return (
    marketDataPreviewIdentity(env) &&
    env.VERCEL_PROJECT_ID === manifest.projectId &&
    env.MARKET_DATA_PROVIDER === "the-odds-api" &&
    env.MARKET_DATA_POLLING_ENABLED === "false" &&
    env.EDGE_SCANNER_ENABLED === "false" &&
    env.AUTO_PUBLISH_DOCKED_EDGES === "false" &&
    env.PROVIDER_TRIAL_ENABLED === "true" &&
    !env.ODDSPAPI_API_KEY?.trim() &&
    [
      "ADS_ENABLED",
      "AFFILIATES_ENABLED",
      "PAID_PLANS_ENABLED",
      "PRO_ENTITLEMENTS_ENABLED",
      "COMPETITIONS_ENABLED",
      "PRIZES_ENABLED",
      "DEALS_ENABLED",
    ].every((k) => env[k] === "false")
  );
}
export function trialScope(operation: string, competition: string | null) {
  if (operation === "sports" && competition === null) return "sports";
  if (
    ["odds", "events", "scores"].includes(operation) &&
    competition &&
    /^[a-z0-9_]{1,100}$/.test(competition)
  )
    return `${operation}:${competition}`;
  throw Error("Unsupported trial request scope");
}
/** Even a free metadata request stops after a known account or trial exhaustion. */
export function trialExecutionAvailable(input: {
  cap: number; charged: number; attempts: number; attemptCap: number; remaining: number | null;
}) {
  return Number.isSafeInteger(input.cap) && input.cap > 0 && input.cap <= 250 &&
    Number.isSafeInteger(input.charged) && input.charged >= 0 && input.charged < input.cap &&
    Number.isSafeInteger(input.attempts) && input.attempts >= 0 && input.attempts < input.attemptCap &&
    (input.remaining === null || (Number.isSafeInteger(input.remaining) && input.remaining > 0));
}
