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
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!communityAdminSections.some(([id]) => id === section)) notFound();
  return <CommunityAdminPage section={section} />;
}
