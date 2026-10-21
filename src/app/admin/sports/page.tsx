import { requireRole } from "@/server/auth";
import { AdminShell } from "@/components/admin-shell";
import { adminDisplayName } from "@/server/admin-display-name";
import { SportSandbox } from "@/components/sport-sandbox";
import { sportSandbox } from "@/server/sport-sandbox";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const dynamic = "force-dynamic";
export default async function SportsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  try {
    const who = await requireRole(["owner", "admin"]);
    const { state } = await sportSandbox((await searchParams).sport ?? "afl");
    return (
      <AdminShell role={who.role} displayName={await adminDisplayName(who)}>
        <SportSandbox initial={state} />
      </AdminShell>
    );
  } catch (e) {
    const kind = memberAccessFailure(e);
    return (
      <FantasyLoadError
        authRequired={kind === "authentication"}
        mfaRequired={kind === "mfa"}
        permissionDenied={kind === "permission"}
      />
    );
  }
}
