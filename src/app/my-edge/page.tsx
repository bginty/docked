import { MyEdgeScreen } from "@/components/app-member-screens";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My Edge",
  robots: { index: false, follow: false },
};
export default async function MyEdge({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <MyEdgeScreen query={await searchParams} />;
}
