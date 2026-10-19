import { AdminShell } from "@/components/admin-shell";
import { MemberReleaseAdmin } from "@/components/member-release-admin";
import { memberReleaseAdmin } from "@/server/member-release";
import { requireRole } from "@/server/auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  const who = await requireRole(["owner", "admin"]);
  return (
    <AdminShell
      role={who.role}
      displayName="Administration"
      active="competitions"
    >
      <MemberReleaseAdmin initial={await memberReleaseAdmin()} />
    </AdminShell>
  );
}
