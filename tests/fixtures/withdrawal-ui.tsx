import { createRoot } from "react-dom/client";
import { CommercialWithdrawals } from "../../src/components/commercial-withdrawals";
import { CommercialWithdrawalOperations } from "../../src/components/commercial-withdrawal-operations";

createRoot(document.getElementById("fixture-root")!).render(
  <div className="page">
    <p style={{ background: "#fff2b5", color: "#172331", padding: 12 }}>
      ISOLATED UI FIXTURE — synthetic identity, bank and money only
    </p>
    {location.pathname.startsWith("/owner") ? (
      <CommercialWithdrawalOperations />
    ) : (
      <CommercialWithdrawals />
    )}
  </div>,
);
