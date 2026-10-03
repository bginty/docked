import { CommunityAdminPage } from "@/components/community-admin-page";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Community operations",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <CommunityAdminPage section="overview" />;
}
