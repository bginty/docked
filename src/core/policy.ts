export type RegionPolicy = {
  country: string;
  state: string;
  effectiveFrom: string;
  effectiveTo: string;
  reviewAt: string;
  approved: boolean;
  minimumAge: number;
  features: string[];
  operators: string[];
  evidence: string;
  version: string;
};
export function eligible(
  policy: RegionPolicy | null,
  location: { country: string; state: string; ageAttested: boolean },
  feature: string,
  now: string,
  operator?: string,
) {
  if (
    !policy ||
    !policy.approved ||
    !policy.evidence ||
    policy.country !== location.country ||
    policy.state !== location.state ||
    !location.ageAttested
  )
    return false;
  const t = Date.parse(now);
  if (
    !Number.isFinite(t) ||
    ![policy.effectiveFrom, policy.effectiveTo, policy.reviewAt].every((s) =>
      Number.isFinite(Date.parse(s)),
    )
  )
    return false;
  return (
    t >= Date.parse(policy.effectiveFrom) &&
    t < Date.parse(policy.effectiveTo) &&
    t < Date.parse(policy.reviewAt) &&
    policy.features.includes(feature) &&
    (!operator || policy.operators.includes(operator))
  );
}
export type GateState = {
  region: boolean;
  strategy: boolean;
  feed: boolean;
  publication: boolean;
};
export function boardState(g: GateState) {
  if (!g.region)
    return {
      code: "restricted",
      title: "Not available in your region",
      detail:
        "Educational resources remain available. Actionable tips require an approved country and state policy.",
    };
  if (!g.strategy)
    return {
      code: "research_pending",
      title: "Research validation pending",
      detail:
        "Historical validation and forward paper review must pass before tips can launch.",
    };
  if (!g.feed)
    return {
      code: "feed_unavailable",
      title: "Data feed unavailable",
      detail:
        "New publication is paused. This is not a successful scan with no opportunities.",
    };
  if (!g.publication)
    return {
      code: "paused",
      title: "Publication paused",
      detail: "The board is temporarily paused by the operator.",
    };
  return {
    code: "no_edge",
    title:
      "No qualifying edge right now. We publish only when our rules are met.",
    detail: "A day without a qualifying opportunity is a valid result.",
  };
}
