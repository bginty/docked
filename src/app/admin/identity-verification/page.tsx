import { AppShell } from "@/components/app-shell";
import { IdentityVerification } from "@/components/identity-verification";
import { redemptionSource } from "@/server/redemptions";
import { requireRole } from "@/server/auth";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (process.env.DOCKED_REDEMPTION_LOCAL !== "true") {
    try {
      await requireRole(["owner"]);
    } catch {
      notFound();
    }
    return (
      <AppShell authenticated>
        <section className="identity-page">
          <h1>Identity verification</h1>
          <p>
            Document collection and staff review are not enabled in this test
            environment.
          </p>
          <p>
            Accepted-document policy, privacy and retention rules, private
            storage, scanning, reviewer permissions and support-email delivery
            must be approved and configured before real documents can be
            accepted.
          </p>
          <p>
            No documents, account approvals or payment permissions have been
            changed.
          </p>
        </section>
      </AppShell>
    );
  }
  const data = await redemptionSource(true);
  if (!data.permissions.includes("identity"))
    throw Error("Identity reviewer permission required");
  return (
    <AppShell authenticated>
      <IdentityVerification admin />
    </AppShell>
  );
}
