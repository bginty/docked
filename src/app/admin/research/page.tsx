import Link from "next/link";
import { requireRole } from "@/server/auth";
import { researchDashboard } from "@/server/research-engine";
import { researchFactTypes } from "@/core/research-engine";
import { AppShell } from "@/components/app-shell";
import { AppHeading } from "@/components/community-basics";
import {
  ResearchDashboardView,
  ResearchNavigation,
} from "@/components/research-admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Research operations",
  robots: { index: false, follow: false },
};
export default async function ResearchAdmin() {
  try {
    await requireRole(["owner", "admin", "analyst", "editor", "auditor"]);
  } catch {
    return (
      <div className="page">
        <AppHeading
          eyebrow="PRIVATE RESEARCH"
          title="Verified staff access required"
        />
        <p>
          Source permissions and retained research evidence require a current
          staff role and MFA.
        </p>
        <Link className="button" href="/mfa">
          Verify MFA
        </Link>
      </div>
    );
  }
  const data = await researchDashboard();
  return (
    <AppShell authenticated>
      <AppHeading
        eyebrow="GOVERNED SPORTING RESEARCH"
        title="Research sources and matches"
      >
        Structured facts, reviewed permissions and immutable as-of evidence.
      </AppHeading>
      <ResearchNavigation />
      <ResearchDashboardView data={data} factTypes={researchFactTypes} />
    </AppShell>
  );
}
