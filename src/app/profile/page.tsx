import { MemberProfile } from "@/components/member-profile";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My Docked",
  robots: { index: false, follow: false },
};
export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <MemberProfile query={await searchParams} />;
}
