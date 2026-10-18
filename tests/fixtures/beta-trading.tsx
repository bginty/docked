import { createRoot } from "react-dom/client";
import { OwnerMarketplace } from "../../src/components/owner-marketplace";
import { AdminShell } from "../../src/components/admin-shell";
fetch("/local-report")
  .then((r) => r.json())
  .then((initial) =>
    createRoot(document.getElementById("fixture-root")!).render(
      <AdminShell role="owner" displayName="Local QA" active="marketplace">
        <OwnerMarketplace initial={initial} />
      </AdminShell>,
    ),
  );
