import { createRoot } from "react-dom/client";
import { OwnerPackAwards } from "../../src/components/owner-pack-awards";
import type { OwnerPackAwardView } from "../../src/core/owner-pack-awards";

declare global {
  interface Window {
    ownerAwardFixture: { owner: string; view: OwnerPackAwardView };
  }
}

createRoot(document.getElementById("fixture-root")!).render(
  <OwnerPackAwards
    key={window.ownerAwardFixture.owner}
    ownerId={window.ownerAwardFixture.owner}
    initialView={window.ownerAwardFixture.view}
  />,
);
