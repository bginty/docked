import { MyEdgeScreen } from "@/components/app-member-screens";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My Edge",
  robots: { index: false, follow: false },
};
export default function MyEdge() {
  return <MyEdgeScreen />;
}
