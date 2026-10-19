import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { OfficialAnnouncement } from "@/components/official-announcement";
import { memberAnnouncements } from "@/server/member-announcements";
import { FantasyLoadError } from "@/components/fantasy-load-error";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked announcement",
  robots: { index: false, follow: false },
};
export default async function Announcement({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let items;
  try {
    items = await memberAnnouncements(1, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return (
      <FantasyLoadError
        authRequired={message === "Authentication required"}
        mfaRequired={message === "Privileged MFA required"}
      />
    );
  }
  const [item] = items;
  if (!item) notFound();
  return (
    <AppShell authenticated>
      <Link className="button ghost" href="/fantasy/announcements">
        All announcements
      </Link>
      <OfficialAnnouncement item={item} archive />
    </AppShell>
  );
}
