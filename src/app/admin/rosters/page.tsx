import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { OwnerRosters } from "@/components/owner-rosters";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { adminDisplayName } from "@/server/admin-display-name";
import { requireRole } from "@/server/auth";
import { ownerRosters } from "@/server/owner-rosters";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Player roster and club audit",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let who;
  try {
    who = await requireRole(["owner"]);
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
  const params = await searchParams;
  const invalid = Object.values(params).some(Array.isArray);
  const query = Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const [displayName, report] = await Promise.all([
    adminDisplayName(who),
    invalid ? Promise.resolve(null) : ownerRosters(query).catch(() => null),
  ]);
  return (
    <AdminShell role={who.role} displayName={displayName} active="cards">
      {report ? (
        <OwnerRosters report={report} ownerId={who.user.id} />
      ) : (
        <section className="panel">
          <h1>Player roster</h1>
          <p role="alert">
            The roster could not be loaded. Check your filters and Owner access,
            then try again.
          </p>
          <div className="actions">
            <Link href="/admin/rosters">Reset filters and reload</Link>
            <Link href="/admin/operations">Commercial operations</Link>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
