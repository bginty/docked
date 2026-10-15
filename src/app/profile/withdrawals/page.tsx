import { AppShell } from "@/components/app-shell";
import { Withdrawals } from "@/components/withdrawals";
import { requireIdentity } from "@/server/auth";
export const dynamic = "force-dynamic";
export default async function WithdrawalPage() {
  await requireIdentity();
  return (
    <AppShell authenticated>
      <Withdrawals />
    </AppShell>
  );
}
