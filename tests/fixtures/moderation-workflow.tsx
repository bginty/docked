import { createRoot } from "react-dom/client";
import { ModerationCasePanel } from "../../src/components/moderation-case-panel";
import { ModerationRetentionPanel } from "../../src/components/moderation-retention-panel";
createRoot(document.getElementById("root")!).render(
  <main className="app-shell">
    <h1>Isolated moderation acceptance</h1>
    <ModerationCasePanel reportId="10000000-0000-4000-8000-000000000001" />
    <ModerationRetentionPanel />
  </main>,
);
