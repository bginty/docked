import { hydrateRoot } from "react-dom/client";
import { LocalDateTime } from "../../src/components/local-date-time";
hydrateRoot(
  document.getElementById("fixture-root")!,
  <LocalDateTime value="2026-10-16T00:15:00+00:00" />,
);
