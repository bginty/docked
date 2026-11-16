import { createRoot } from "react-dom/client";
import { PublicPhoneVerification } from "../../src/components/public-phone-verification";
createRoot(document.getElementById("fixture-root")!).render(
  <PublicPhoneVerification />,
);
