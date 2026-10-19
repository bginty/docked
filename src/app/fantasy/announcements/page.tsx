import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OfficialAnnouncement } from "@/components/official-announcement";
import { memberAnnouncements } from "@/server/member-announcements";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked announcements",
  robots: { index: false, follow: false },
};
export default async function Announcements({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const q = await searchParams,
    page = Math.max(1, Math.min(1000, Number(q.page) || 1));
  const items = await memberAnnouncements(page);
  return (
    <AppShell authenticated>
      <h1>Docked announcements</h1>
      <Link className="button ghost" href="/fantasy/social">
        Back to Social
      </Link>
      {items.length ? (
        items
          .slice(0, 25)
          .map((item) => (
            <OfficialAnnouncement key={item.id} item={item} archive />
          ))
      ) : (
        <p>No published announcements yet.</p>
      )}
      <nav className="actions" aria-label="Announcement pages">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        {items.length > 25 && <Link href={`?page=${page + 1}`}>Next</Link>}
      </nav>
    </AppShell>
  );
}
