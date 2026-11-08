// Isolated component fixture. Every request is intercepted by its browser test.
import { createRoot } from "react-dom/client";
import { Marketplace } from "../../src/components/credit-marketplace";
Object.assign(window, { demoPath: "/fantasy/market" });
createRoot(document.getElementById("fixture-root")!).render(
  <div className="app-content">
    <Marketplace member="00000000-0000-4000-8000-000000000001" />
  </div>,
);
