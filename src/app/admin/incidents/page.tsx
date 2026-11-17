import { requireRole } from "@/server/auth";
import { operationalIncidents } from "@/server/operational-incidents";
import { AdminShell } from "@/components/admin-shell";
import { OperationalIncidents } from "@/components/operational-incidents";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { adminDisplayName } from "@/server/admin-display-name";
import { phoneDeliveryReady, verifiedPhone } from "@/core/public-phone";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Operational incidents",
  robots: { index: false, follow: false },
};
export default async function Incidents() {
  try {
    const who = await requireRole(["owner"]);
    const report = await operationalIncidents();
    return (
      <AdminShell role={who.role} displayName={await adminDisplayName(who)}>
        {phoneDeliveryReady() && !verifiedPhone(who.user) && (
          <p>
            <a className="button" href="/app/verify-phone">
              Verify your phone
            </a>
          </p>
        )}
        <OperationalIncidents initial={report} />
      </AdminShell>
    );
  } catch (error) {
    const failure = memberAccessFailure(error);
    return (
      <>
        <FantasyLoadError
          authRequired={failure === "authentication"}
          mfaRequired={failure === "mfa"}
          permissionDenied={failure === "permission"}
        />
        <p>
          Incident review also requires the approved database permissions. No
          payments or account records have changed.
        </p>
      </>
    );
  }
}
