import { createRoot } from "react-dom/client";
import { OwnerRosters } from "../../src/components/owner-rosters";
import type { OwnerRosterReport } from "../../src/core/commercial-player-roster";

declare global {
  interface Window {
    ownerRosterFixture: { owner: string; report: OwnerRosterReport };
  }
}

createRoot(document.getElementById("fixture-root")!).render(
  <OwnerRosters
    ownerId={window.ownerRosterFixture.owner}
    report={window.ownerRosterFixture.report}
  />,
);
