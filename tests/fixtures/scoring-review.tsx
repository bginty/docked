import { createRoot } from "react-dom/client";
import {
  ScoringReview,
  type ScoringDemo,
} from "../../src/components/scoring-review";
import data from "../../config/scoring-demo.json";
createRoot(document.getElementById("fixture-root")!).render(
  <ScoringReview data={data as ScoringDemo} />,
);
