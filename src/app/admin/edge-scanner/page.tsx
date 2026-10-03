import { ScannerAdminPage } from "@/components/scanner-admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Edge Scanner",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ScannerAdminPage section="scanner" />;
}
