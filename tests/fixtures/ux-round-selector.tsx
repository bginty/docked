import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CompetitionWeekSelector } from "../../src/components/competition-week-selector";
import type { FantasyCompetition } from "../../src/core/fantasy";
const now = Date.now();
const at = (hours: number) => new Date(now + hours * 3600000).toISOString();
const rounds: FantasyCompetition[] = [
  {
    id: "past",
    name: "QA closed",
    season: "PRIVATE-TEST-2026",
    round: 6,
    opens_at: at(-200),
    locks_at: at(-100),
    scored_at: null,
    rules: {},
  },
  {
    id: "final",
    name: "QA final",
    season: "PRIVATE-TEST-2026",
    round: 7,
    opens_at: at(-100),
    locks_at: at(-80),
    scored_at: at(-20),
    rules: {},
  },
  {
    id: "current",
    name: "QA current",
    season: "2026",
    round: 8,
    opens_at: at(-5),
    locks_at: at(20),
    scored_at: null,
    rules: {},
  },
  {
    id: "next",
    name: "QA next",
    season: "2026",
    round: 9,
    opens_at: at(100),
    locks_at: at(200),
    scored_at: null,
    rules: {},
  },
  {
    id: "practice",
    name: "NFL Practice",
    season: "PRIVATE-TEST-PRACTICE-2026",
    round: 1,
    opens_at: at(-5),
    locks_at: at(500),
    scored_at: null,
    rules: { stream: "beta-real:qa" },
  },
];
function Fixture() {
  const [selected, setSelected] = useState("current");
  return (
    <main
      className="fantasy-play seven-play"
      style={{
        maxWidth: 760,
        margin: "auto",
        padding: 16,
        display: "block",
        minHeight: "auto",
      }}
    >
      <h1>Play</h1>
      <p>LOCAL FIXTURE · no real accounts or entries</p>
      <CompetitionWeekSelector
        rounds={rounds}
        selected={selected}
        onSelect={setSelected}
      />
      <p role="status">Selected: {selected}</p>
    </main>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
