import { createRoot } from "react-dom/client";
import { MfaForm } from "../../src/components/mfa-form";
createRoot(document.getElementById("fixture-root")!).render(
  <section className="app-auth-surface">
    <div className="app-auth-content">
      <h1>Protect your account</h1>
      <MfaForm />
    </div>
  </section>,
);
