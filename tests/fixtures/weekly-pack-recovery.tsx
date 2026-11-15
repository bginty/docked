import { createRoot } from "react-dom/client";
import { WeeklyCorePanel } from "../../src/components/weekly-core-panel";

createRoot(document.getElementById("fixture-root")!).render(
  <WeeklyCorePanel member="isolated-weekly" sport="nfl" history />,
);
