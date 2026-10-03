import Link from "next/link";
import { requireRole } from "@/server/auth";
import { dataHealth } from "@/server/data-health";
import { PageHeading, Notice } from "@/components/ui";
import { DataHealthPanel } from "@/components/data-health-panel";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin data health",
  robots: { index: false, follow: false },
};
export default async function DataHealth() {
  try {
    await requireRole(["owner", "admin", "analyst", "auditor"]);
  } catch {
    return (
      <div className="page">
        <PageHeading eyebrow="RESTRICTED OPERATIONS" title="Data health" />
        <Notice>
          Verified staff access and MFA are required to inspect provider
          diagnostics.
        </Notice>
        <Link href="/login">Log in</Link>
      </div>
    );
  }
  return <DataHealthPanel health={await dataHealth()} />;
}
