// Synthetic data only. Application components are imported without overrides.
import { createRoot } from "react-dom/client";
import { WeeklyCorePanel } from "../../src/components/weekly-core-panel";
const sport = new URLSearchParams(location.search).get("sport") as
  "nfl" | "afl" | "nrl";
createRoot(document.getElementById("fixture-root")!).render(
  <main>
    <h1>Isolated Weekly Core acceptance</h1>
    <WeeklyCorePanel member="audit-member" sport={sport} />
  </main>,
);
