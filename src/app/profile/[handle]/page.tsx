import { MemberProfile } from "@/components/member-profile";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Community profile",
  robots: { index: false, follow: false },
};
export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <MemberProfile handle={(await params).handle} query={await searchParams} />
  );
}
