import { memberReturnPath } from "./member-access-recovery";

/** Routing only. postBetaOwner is derived from verified identity + database role. */
export function postBetaOwnerDestination(
  who: { postBetaOwner?: boolean; customerView?: boolean; aal: string } | null,
  next?: string,
) {
  if (!who?.postBetaOwner) return null;
  if (who.customerView && who.aal === "aal2") return null;
  const candidate = memberReturnPath(next);
  const destination =
    candidate && /^\/admin(?:\/|$)/.test(candidate)
      ? candidate
      : "/admin/operations";
  return who.aal === "aal2"
    ? destination
    : `/mfa?next=${encodeURIComponent(destination)}`;
}
