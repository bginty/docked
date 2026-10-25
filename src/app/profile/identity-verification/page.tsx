import { AppShell } from "@/components/app-shell";
import { IdentityVerification } from "@/components/identity-verification";
import { requireIdentity } from "@/server/auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireIdentity();
  return (
    <AppShell authenticated>
      <IdentityVerification />
    </AppShell>
  );
}
