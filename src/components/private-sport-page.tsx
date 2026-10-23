import { AppShell } from "./app-shell";
import { FantasyLoadError } from "./fantasy-load-error";
import { requireIdentity } from "@/server/auth";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { boundedRead } from "@/core/bounded-request";

/** The existing SportScope loads the selected sport through its gated API.
 * Do not first load NFL inventory or duplicate the wallet projection here. */
export async function PrivateSportPage() {
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
      <p role="status">Loading your sport…</p>
    </AppShell>
  );
}
