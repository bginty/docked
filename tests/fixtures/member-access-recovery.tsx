// Local-only recovery UI fixture. Never authenticates or contacts a hosted account.
import { createRoot } from "react-dom/client";
import { FantasyLoadError } from "../../src/components/fantasy-load-error";
import { MfaForm } from "../../src/components/mfa-form";
import { AppAuthForm } from "../../src/components/app-auth-forms";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { memberReturnPath } from "../../src/core/member-access-recovery";
const q = new URLSearchParams(location.search),
  kind = q.get("failure");
const next = memberReturnPath(q.get("next")) ?? "/fantasy/play";
createRoot(document.getElementById("fixture-root")!).render(
  location.pathname === "/mfa" ? (
    <MfaForm next={next} />
  ) : location.pathname === "/app/login" ? (
    <EnvironmentProvider
      value={{
        production: false,
        accountConfigured: true,
        reviewOnly: false,
        liveBeta: false,
        registrationAvailable: false,
        emailAvailable: false,
        invitationAllowed: false,
      }}
    >
      <AppAuthForm mode="login" next={next} />
    </EnvironmentProvider>
  ) : (
    <FantasyLoadError
      authRequired={kind === "auth"}
      mfaRequired={kind === "mfa"}
      permissionDenied={kind === "permission"}
    />
  ),
);
