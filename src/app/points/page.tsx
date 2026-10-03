import { PointsScreen } from "@/components/app-member-screens";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your points",
  robots: { index: false, follow: false },
};
export default function Points() {
  return <PointsScreen />;
}
