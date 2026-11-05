import { createRoot } from "react-dom/client";
import { AppOnboardingForm } from "../../src/components/app-auth-forms";
import { EnvironmentProvider } from "../../src/components/environment-context";
createRoot(document.getElementById("fixture-root")!).render(
  <EnvironmentProvider
    value={{
      production: true,
      registrationAvailable: false,
      emailAvailable: true,
      invitationAllowed: false,
      policyVersions: {
        terms: "reviewed-public-terms-v2",
        privacy: "reviewed-public-privacy-v2",
      },
      accountConfigured: true,
      reason: "Registration remains closed.",
    }}
  >
    <section className="app-auth-surface">
      <p>ISOLATED FORM FIXTURE · No account changes</p>
      <AppOnboardingForm
        legalRequired
        usernameRequired
        minimumAge={18}
        endpoint="/api/auth/public-member-setup"
        completionPath="/app/onboarding/public"
        termsHref="/commercial-policy"
        preferences={{
          sports: [],
          interests: "both",
          officialEdges: false,
          followedMembers: false,
          replies: false,
          timezone: "Australia/Sydney",
          country: "",
          state: "",
          username: "",
        }}
      />
    </section>
  </EnvironmentProvider>,
);
