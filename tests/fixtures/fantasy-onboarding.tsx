import { createRoot } from "react-dom/client";
import { AppOnboardingForm } from "../../src/components/app-auth-forms";
createRoot(document.getElementById("fixture-root")!).render(
  <section className="app-auth-surface">
    <p>DESIGN FIXTURE · no account changes</p>
    <AppOnboardingForm
      legalRequired={false}
      usernameRequired={false}
      minimumAge={18}
      preferences={{
        sports: [],
        interests: "both",
        officialEdges: false,
        followedMembers: false,
        replies: false,
        timezone: "Australia/Sydney",
        country: "AU",
        state: "NSW",
        username: "fictional_tester",
      }}
    />
  </section>,
);
