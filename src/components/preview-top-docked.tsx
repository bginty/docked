import Link from "next/link";
import { topDockedRuleV1 } from "@/core/top-docked";

/** Isolated preview explanation: intentionally accepts no performance or rank data. */
export function PreviewTopDocked() {
  return (
    <section className="app-panel" aria-labelledby="preview-top-title">
      <p className="eyebrow">PREVIEW TOP DOCKED</p>
      <h1 id="preview-top-title">A record earns its place.</h1>
      <p>No genuine performance or rankings are available in this test view.</p>
      <p>
        Your DEMO / PREVIEW PRICE records practise confirmation and permanent
        capture. They have no settlements, points, ROI or ranking and never
        count toward the genuine leaderboard.
      </p>
      <h2>What a genuine record would need</h2>
      <p>
        Published rule {topDockedRuleV1.version} requires at least{" "}
        {topDockedRuleV1.minimumSettled} settled, non-void verified Edges across{" "}
        {topDockedRuleV1.minimumActiveDays} active UTC days in the selected
        window. All eligible wins and losses stay in the record; unresolved
        integrity reviews prevent ranking. Followers and payment never improve
        rank.
      </p>
      <p>
        Those are sample rules, not evidence of future profit. Preview test
        activity cannot satisfy them.
      </p>
      <div className="actions">
        <Link className="button" href="/compose">
          Practise a DEMO Edge
        </Link>
        <Link className="button secondary" href="/learn/how-top-docked-works">
          Read the qualification rules
        </Link>
      </div>
    </section>
  );
}
