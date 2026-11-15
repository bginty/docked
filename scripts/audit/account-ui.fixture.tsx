import { createRoot } from "react-dom/client";
import { PublicPhoneVerification } from "../../src/components/public-phone-verification";
import { AuthFormHydrationView } from "../../tests/fixtures/auth-form-hydration-view";
createRoot(document.getElementById("fixture-root")!).render(
  <main className="app-auth-page">
    {location.pathname.includes("phone") ? (
      <PublicPhoneVerification />
    ) : (
      <AuthFormHydrationView />
    )}
  </main>,
);
