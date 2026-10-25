import { AppShell } from "@/components/app-shell";
import { IdentityVerification } from "@/components/identity-verification";
import { requireIdentity } from "@/server/auth";
import { FantasyLoadError } from "@/components/fantasy-load-error";
export const dynamic = "force-dynamic";
export default async function Page() {
  try {
    await requireIdentity();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return (
      <FantasyLoadError
        authRequired={message === "Authentication required"}
        mfaRequired={message === "Privileged MFA required"}
      />
    );
  }
  return (
    <AppShell authenticated>
      <IdentityVerification />
    </AppShell>
  );
}
