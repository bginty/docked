import { AppShell } from "@/components/app-shell";
import { Withdrawals } from "@/components/withdrawals";
import { requireIdentity } from "@/server/auth";
import { CommercialWithdrawals } from "@/components/commercial-withdrawals";
export const dynamic = "force-dynamic";
export default async function WithdrawalPage() {
  await requireIdentity();
  return (
    <AppShell authenticated>
      {process.env.DOCKED_COMMERCIAL_SERVICE === "true" &&
      process.env.DOCKED_BETA_STAGING !== "true" ? (
        <CommercialWithdrawals />
      ) : (
        <Withdrawals />
      )}
    </AppShell>
  );
}
