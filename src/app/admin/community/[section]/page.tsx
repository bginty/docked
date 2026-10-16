import { notFound } from "next/navigation";
import { CommunityAdminPage } from "@/components/community-admin-page";
import { communityAdminSections } from "@/core/community-navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Community operations",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  if (!communityAdminSections.some(([id]) => id === section)) notFound();
  const query = await searchParams;
  return (
    <CommunityAdminPage
      section={section}
      kind={typeof query.kind === "string" ? query.kind : undefined}
    />
  );
}
