import { AppShell } from "@/components/app-shell";
import { Withdrawals } from "@/components/withdrawals";
import { redemptionSource } from "@/server/redemptions";
export const dynamic = "force-dynamic";
export default async function RedemptionsAdmin() {
  await redemptionSource(true);
  return (
    <AppShell authenticated>
      <Withdrawals admin />
    </AppShell>
  );
}
