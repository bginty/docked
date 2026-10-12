import { createRoot } from "react-dom/client";
import { NativeBridge } from "../../src/components/native-bridge";
import { MfaForm } from "../../src/components/mfa-form";
createRoot(document.getElementById("fixture-root")!).render(
  <>
    <NativeBridge />
    <h1>Verify your authenticator</h1>
    <MfaForm />
  </>,
);
