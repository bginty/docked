import { createRoot } from "react-dom/client";
import { FounderCreditPanel } from "../../src/components/founder-credit-panel";
createRoot(document.getElementById("fixture-root")!).render(
  <FounderCreditPanel />,
);
