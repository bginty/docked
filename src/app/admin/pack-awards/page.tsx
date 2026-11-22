import { AdminShell } from "@/components/admin-shell";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import {
  OwnerPackAwards,
  type AwardRecipient,
} from "@/components/owner-pack-awards";
import { adminDisplayName } from "@/server/admin-display-name";
import { adminRecord } from "@/server/admin-record";
import { requireRole } from "@/server/auth";
import { ownerPackAwardsView } from "@/server/owner-pack-awards";
import { memberAccessFailure } from "@/core/member-access-recovery";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Award promotional and prize packs",
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
  const query = await searchParams;
  const member =
    typeof query.member === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      query.member,
    )
      ? query.member
      : null;
  const [displayName, view, record] = await Promise.all([
    adminDisplayName(who),
    ownerPackAwardsView().catch(() => null),
    member
      ? adminRecord({ category: "members", record: member }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const recipient: AwardRecipient | null = record
    ? {
        id: record.id,
        title: record.title,
        detail: record.fields["Restricted at"]
          ? "Account restricted"
          : "Account enabled",
      }
    : null;
  return (
    <AdminShell role={who.role} displayName={displayName} active="packs">
      <OwnerPackAwards
        key={who.user.id}
        ownerId={who.user.id}
        initialView={view}
        initialRecipient={recipient}
      />
    </AdminShell>
  );
}
