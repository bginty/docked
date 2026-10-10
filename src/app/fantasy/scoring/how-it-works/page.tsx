import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireIdentity } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { rulesets, sports } from "@/core/scoring-v1";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "How scoring works · beta",
  robots: { index: false, follow: false },
};
export default async function RulesPage() {
  if (
    process.env.VERCEL_ENV !== "preview" &&
    process.env.NODE_ENV !== "development"
  )
    notFound();
  try {
    await requireIdentity();
  } catch (error) {
    redirect(
      error instanceof Error && error.message === "Privileged MFA required"
        ? "/mfa"
        : "/app/login",
    );
  }
  return (
    <AppShell authenticated>
      <section className="scoring-review">
        <p className="scoring-badge">PROVISIONAL BETA RULES · NO LIVE FEEDS</p>
        <h1>How scoring works</h1>
        <p>
          Docked calculates its own match points from statistics. Card rarity,
          level, price and ownership history never multiply points. Daily
          rewards and engagement points remain separate. No mixed-sport
          leaderboard.
        </p>
        <Link href="/fantasy/scoring">
          Explore simulated match breakdowns →
        </Link>
        {sports.map((sport) => (
          <article key={sport} className="scoring-team">
            <h2>{rulesets[sport].title}</h2>
            <p>
              Version: {rulesets[sport].version}. Historical balance unverified.
            </p>
            <ul>
              {rulesets[sport].policy.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p>
              Provisional correction window: {rulesets[sport].correctionHours}{" "}
              hours after each fixture ends. Finalisation requires every
              scheduled fixture to be resolved and every window elapsed.
            </p>
          </article>
        ))}
        <h2>Locks, delays and corrections</h2>
        <p>
          Each period declares its fixtures, deadline, rules and eligible
          positions before team submission. All active slots lock together at
          that period’s published deadline (no later than its earliest kickoff).
          Ownership and eligibility are checked again at lock. No automatic
          bench replacements, captain bonuses or retrospective edits. Later
          trades and position changes do not rewrite the locked team.
        </p>
        <p>
          Multiple fixtures in one period score once each, then sum. Postponed,
          abandoned, cancelled or missing-data fixtures remain pending, with no
          final zero or ranking. A rescheduled fixture retains its original
          period and locked lineup; a replay must be mapped to that same
          canonical fixture and replace the abandoned statistics. No silent
          transfer to another week or round. An unresolved cancellation needs a
          separately approved void policy; this beta does not auto-void it.
        </p>
        <p>
          Confirmed DNP and byes can receive an explicit zero with source
          evidence. Partial statistics are not final. Provider outages pause
          completion. Corrections within the window replace calculated totals
          and retain revisions. A late or post-final correction requires an
          authorised reviewer, a reason and an audit record; it reopens
          provisional results until reviewed finalisation.
        </p>
        <p>
          EPL and AFL windows are 72 hours; NFL is 96 hours. These are Docked
          provisional choices, not guarantees that providers cannot correct
          later. Shared ranks are used for tied totals. Competitions remain
          sport-specific.
        </p>
      </section>
    </AppShell>
  );
}
