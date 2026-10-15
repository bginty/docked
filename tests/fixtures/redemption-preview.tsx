import { createRoot } from "react-dom/client";
import { Withdrawals } from "../../src/components/withdrawals";
const admin = location.pathname.startsWith("/admin");
createRoot(document.getElementById("root")!).render(
  <>
    <header
      style={{
        padding: "18px 24px",
        borderBottom: "1px solid #283b56",
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <img
        src="/brand/docked/logos/docked-logo-horizontal.webp"
        alt="Docked"
        width="160"
      />
      <span>ISOLATED DEVELOPMENT PREVIEW</span>
      <a href="/qa">Switch fixture role</a>
      <a href={admin ? "/profile/withdrawals" : "/admin/redemptions"}>
        {admin ? "Customer view" : "Staff view"}
      </a>
    </header>
    <Withdrawals admin={admin} />
  </>,
);
