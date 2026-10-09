import { ScannerAdminPage } from "@/components/scanner-admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Candidate Edges",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <ScannerAdminPage section="candidates" query={await searchParams} />;
}
