import { FollowingScreen } from "@/components/app-member-screens";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Following",
  robots: { index: false, follow: false },
};
export default async function Following({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <FollowingScreen query={await searchParams} />;
}
