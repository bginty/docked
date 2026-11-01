import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { AdminShell } from "@/components/admin-shell";
import { CommercialBillingReview } from "@/components/commercial-billing-review";
import { adminDisplayName } from "@/server/admin-display-name";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Commercial billing review",
  robots: { index: false, follow: false },
};
export default async function Page() {
  let who;
  try {
    who = await requireRole(["owner"]);
  } catch {
    notFound();
  }
  return (
    <AdminShell role={who.role} displayName={await adminDisplayName(who)}>
      {process.env.DOCKED_COMMERCIAL_SERVICE === "true" ? (
        <CommercialBillingReview />
      ) : (
        <section className="panel">
          <h1>Commercial billing</h1>
          <p>
            Commercial billing is disabled. The ledger migration, runtime
            permissions, commercial approvals and acceptance checks must be
            completed before activation.
          </p>
          <p>
            No customer balance, product or payment permission has been changed.
          </p>
        </section>
      )}
    </AdminShell>
  );
}
