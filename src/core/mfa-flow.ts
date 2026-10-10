export type TotpFactor = {
  id: string;
  factor_type: string;
  status: string;
  created_at: string;
};

/** Provider returns only the authenticated user's factors. Never accept a client factor ID. */
export function resolveTotpFactor(factors: TotpFactor[]) {
  const totp = factors.filter((factor) => factor.factor_type === "totp");
  const verified = totp
    .filter((factor) => factor.status === "verified")
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  if (verified.length) return verified[0];
  return (
    totp
      .filter((factor) => factor.status === "unverified")
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
      )[0] ?? null
  );
}

export function mfaDestination(value?: string) {
  return value === "/app/reset-password" ? value : "/app";
}
