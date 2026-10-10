export type TradeFeePolicy = {
  version: string;
  participantCents: number;
  cycleStart: string | null;
  cycleSeconds: number;
  freeSeconds: number;
  quoteSeconds: number;
};
export const proposedTradeFees: TradeFeePolicy = {
  version: "proposal-v1",
  participantCents: 250,
  cycleStart: null,
  cycleSeconds: 28 * 86400,
  freeSeconds: 48 * 3600,
  quoteSeconds: 300,
};
export const sandboxTradeFees: TradeFeePolicy = {
  ...proposedTradeFees,
  cycleStart: "2026-10-10T00:00:00.000Z",
};
export function tradeFeeWindow(policy: TradeFeePolicy, now: number) {
  if (
    !Number.isFinite(now) ||
    !Number.isSafeInteger(policy.participantCents) ||
    policy.participantCents < 0 ||
    !Number.isInteger(policy.cycleSeconds) ||
    !Number.isInteger(policy.freeSeconds) ||
    !Number.isInteger(policy.quoteSeconds) ||
    policy.cycleSeconds <= policy.freeSeconds ||
    policy.freeSeconds <= 0 ||
    policy.quoteSeconds <= 0
  )
    throw Error("Invalid fee configuration");
  if (!policy.cycleStart) return { configured: false as const };
  const start = Date.parse(policy.cycleStart);
  if (!Number.isFinite(start)) throw Error("Invalid cycle start");
  const cycle = policy.cycleSeconds * 1000,
    window = policy.freeSeconds * 1000;
  const period =
    now < start ? start : start + Math.floor((now - start) / cycle) * cycle;
  const free = now >= period && now < period + window;
  const nextBoundary =
    now < start ? start : free ? period + window : period + cycle;
  return {
    configured: true as const,
    free,
    participantCents: free ? 0 : policy.participantCents,
    totalCents: free ? 0 : policy.participantCents * 2,
    opensAt: new Date(free ? period : nextBoundary).toISOString(),
    closesAt: new Date(
      free ? period + window : nextBoundary + window,
    ).toISOString(),
    nextBoundary: new Date(nextBoundary).toISOString(),
    expiresAt: new Date(
      Math.min(now + policy.quoteSeconds * 1000, nextBoundary),
    ).toISOString(),
  };
}
export const formatAUD = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100,
  );
