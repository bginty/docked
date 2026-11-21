import { AdminShell } from "@/components/admin-shell";
import { CommercialWithdrawalOperations } from "@/components/commercial-withdrawal-operations";
import { requireRole } from "@/server/auth";
import { adminDisplayName } from "@/server/admin-display-name";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Withdrawal operations",
  robots: { index: false, follow: false },
};
export default async function WithdrawalOperationsPage() {
  const who = await requireRole(["owner"]);
  return (
    <AdminShell role={who.role} displayName={await adminDisplayName(who)}>
      <CommercialWithdrawalOperations />
    </AdminShell>
  );
}
