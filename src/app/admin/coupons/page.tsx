import { adminCoupons } from "@/server/pack-coupons";
import { requireRole } from "@/server/auth";
import { adminDisplayName } from "@/server/admin-display-name";
import { AdminShell } from "@/components/admin-shell";
import { AdminPackCoupons } from "@/components/admin-pack-coupons";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const dynamic = "force-dynamic";
export default async function CouponPage() {
  try {
    const who = await requireRole(["owner", "admin"]);
    const initial = await adminCoupons();
    return (
      <AdminShell role={who.role} displayName={await adminDisplayName(who)}>
        <AdminPackCoupons initial={initial} />
      </AdminShell>
    );
  } catch (error) {
    const kind = memberAccessFailure(error);
    return (
      <FantasyLoadError
        authRequired={kind === "authentication"}
        mfaRequired={kind === "mfa"}
        permissionDenied={kind === "permission"}
      />
    );
  }
}
