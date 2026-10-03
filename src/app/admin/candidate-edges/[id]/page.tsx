import { ScannerAdminPage } from "@/components/scanner-admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Candidate review",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ScannerAdminPage section="candidates" id={(await params).id} />;
}
