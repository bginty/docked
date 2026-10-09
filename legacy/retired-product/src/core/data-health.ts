import { oddsApiCredential } from "@/providers/credentials";
export type ProviderStatus =
  "NOT_CONFIGURED" | "DISABLED" | "PENDING_RIGHTS" | "READY" | "UNAVAILABLE";
export function providerReadiness(
  env: Record<string, string | undefined>,
  kind: "odds" | "results",
): ProviderStatus {
  if (kind === "results")
    return !env.RESULTS_PROVIDER || !env.RESULTS_RIGHTS_REFERENCE
      ? "NOT_CONFIGURED"
      : env.RESULTS_PROVIDER === "authorised-file"
        ? "READY"
        : "UNAVAILABLE";
  let key: string | undefined;
  try {
    key = oddsApiCredential(env);
  } catch {
    return "UNAVAILABLE";
  }
  if (!key) return "NOT_CONFIGURED";
  if (!env.ODDS_RIGHTS_REFERENCE) return "PENDING_RIGHTS";
  if (env.ODDS_POLLING_ENABLED !== "true") return "DISABLED";
  return "READY";
}
export function freshTimestamp(
  value: Date | string | null | undefined,
  now = Date.now(),
  maxAgeMs = 180000,
) {
  if (!value) return false;
  const at = new Date(value).getTime();
  return Number.isFinite(at) && at <= now && now - at <= maxAgeMs;
}
export function pollBudget(input: {
  limit: number;
  spent: number;
  remaining: number | null;
  cost: number;
}) {
  if (
    !Number.isSafeInteger(input.limit) ||
    input.limit <= 0 ||
    !Number.isFinite(input.spent) ||
    input.spent < 0 ||
    !Number.isSafeInteger(input.cost) ||
    input.cost < 1
  )
    return { allowed: false, reason: "budget_not_configured" };
  if (input.limit - input.spent < input.cost)
    return { allowed: false, reason: "local_budget_exhausted" };
  if (
    input.remaining !== null &&
    (!Number.isFinite(input.remaining) || input.remaining < input.cost)
  )
    return { allowed: false, reason: "provider_quota_exhausted" };
  return { allowed: true, reason: "reserved" };
}
