import { createRoot } from "react-dom/client";
import { NflTestingPanel } from "../../src/components/nfl-testing-panel";
fetch("/report.json")
  .then((r) => r.json())
  .then((report) =>
    createRoot(document.getElementById("fixture-root")!).render(
      <main>
        <NflTestingPanel report={report} />
      </main>,
    ),
  );
