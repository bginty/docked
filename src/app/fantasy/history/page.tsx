import { requireIdentity } from "@/server/auth";
import { boundedRead } from "@/core/bounded-request";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { AppShell } from "@/components/app-shell";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { HistoricalFixtures } from "@/components/historical-fixtures";
export const dynamic = "force-dynamic";
export default async function Page() {
  try {
    await boundedRead(requireIdentity());
  } catch (error) {
    const kind = memberAccessFailure(error);
    return (
      <FantasyLoadError
        authRequired={kind === "authentication"}
        mfaRequired={kind === "mfa"}
        permissionDenied={kind === "permission"}
      />
    );
  }
  return (
    <AppShell authenticated>
      <HistoricalFixtures />
    </AppShell>
  );
}
