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
