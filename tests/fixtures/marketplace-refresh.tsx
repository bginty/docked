// Isolated component fixture. Every request is intercepted by its browser test.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Marketplace } from "../../src/components/credit-marketplace";
Object.assign(window, { demoPath: "/fantasy/market" });
function Fixture() {
  const [member, setMember] = useState("00000000-0000-4000-8000-000000000001");
  Object.assign(window, { fixtureSetMember: setMember });
  return (
    <div className="app-content">
      <Marketplace member={member} />
    </div>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
