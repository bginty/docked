import { competitionNames } from "@/core/competition-display";
import Link from "next/link";
import { redirect } from "next/navigation";
import { fantasyRequest } from "@/server/fantasy";
import { AppShell } from "@/components/app-shell";
import {
  rulesets,
  nflRarityRules,
  nflAlignedRules,
  nflFutureRarityRules,
} from "@/core/scoring-v1";
import { sevenRules, nflSeven, sevenTransferNotice } from "@/core/nfl-seven";
import { rarities, rarityRule } from "@/core/card-rarity";
import { ScoringRulesTable } from "@/components/scoring-rules-table";
import { NflScoringReference } from "@/components/nfl-scoring-reference";
import { sportSandbox } from "@/server/sport-sandbox";
import { requireIdentity } from "@/server/auth";
import { SportScoringReference } from "@/components/sport-scoring-reference";
import {
  australianSalaryLabel,
  usesApprovedAustralianSalary,
} from "@/core/approved-australian-rules";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Scoring rules",
  robots: { index: false, follow: false },
};
export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{
    competition?: string;
    version?: string;
    sport?: string;
  }>;
}) {
  const query = await searchParams;
  if (!query.competition && !query.version) {
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
        <SportScoringReference />
      </AppShell>
    );
  }
  if (query.sport === "afl" || query.sport === "nrl") {
    let data;
    try {
      data = (await sportSandbox(query.sport)).state;
    } catch {
      return (
        <AppShell authenticated>
          <h1>Rules unavailable</h1>
          <p>Sign in with an authorised beta account and retry from Play.</p>
          <Link href={`/fantasy/play?sport=${query.sport}`}>Back to Play</Link>
        </AppShell>
      );
    }
    const rounds = data.competitions
      .filter((c) => c.rules.mode === "SALARY_CAP")
      .sort((a, b) => Date.parse(a.locks_at) - Date.parse(b.locks_at));
    const round = query.competition
      ? data.competitions.find((c) => c.id === query.competition)
      : (rounds.find(
          (c) => Date.parse(c.locks_at) > Date.parse(data.server_time),
        ) ?? rounds.at(-1));
    const cfg = round && data.configurations[round.rules.lineup_version];
    if (!round || !cfg)
      return (
        <AppShell authenticated>
          <h1>Rules unavailable</h1>
          <p>Select an available competition in Play.</p>
        </AppShell>
      );
    const dollars = usesApprovedAustralianSalary(cfg);
    return (
      <AppShell authenticated>
        <section className="scoring-review">
          <h1>{query.sport.toUpperCase()} competition rules</h1>
          <p>
            <Link href={`/fantasy/scoring/how-it-works?sport=${query.sport}`}>
              {query.sport.toUpperCase()} scoring and player statistics
            </Link>
          </p>
          <p>
            {round.name} · Round {round.round}
          </p>
          <h2>
            {round.rules.mode === "OPEN"
              ? "All-Star · No salary cap"
              : `Traditional · ${australianSalaryLabel(cfg) ?? `${cfg.salaryCap.toLocaleString()} test salary units`}`}
          </h2>
          <p>
            {dollars
              ? "Fantasy salary dollars are separate from your Docked Credits."
              : "Historical test salary units. These saved rules have not been converted to fantasy dollars."}
          </p>
          <table>
            <thead>
              <tr>
                <th>Rarity</th>
                <th>Salary</th>
              </tr>
            </thead>
            <tbody>
              {rarities.map((tier) => (
                <tr key={tier}>
                  <td>{rarityRule(tier).label}</td>
                  <td>
                    {dollars ? "$" : ""}
                    {cfg.salaries[tier].toLocaleString()}
                    {dollars ? "" : " test units"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {cfg.slots.length} players. Each player may appear once; slot
            eligibility, ownership and round lock rules apply.
          </p>
          <p>
            Scoring and historical results use the selected competition’s saved
            rules. Private beta statistics and prize restrictions still apply.
          </p>
          <Link
            href={`/fantasy/play?sport=${query.sport}&competition=${round.id}`}
          >
            Back to Lineup
          </Link>
        </section>
      </AppShell>
    );
  }
  let state;
  try {
    state = (await fantasyRequest()).state;
  } catch (e) {
    redirect(
      e instanceof Error && e.message === "Privileged MFA required"
        ? "/mfa"
        : "/app/login",
    );
  }
  const rounds = state.review?.rounds ?? [];
  const selected = rounds.find((r) => r.id === query.competition);
  const versions = [
    sevenRules(),
    nflAlignedRules(),
    nflFutureRarityRules(),
    nflRarityRules(),
    rulesets.nfl,
  ];
  const rules =
    selected?.rules ??
    (query.version
      ? (rounds.find((r) => r.rules.version === query.version)?.rules ??
        versions.find((r) => r.version === query.version))
      : sevenRules());
  if (!rules || (query.competition && !selected))
    return (
      <AppShell authenticated>
        <h1>Rules unavailable</h1>
        <p>
          This competition or saved rules version is not available to your
          account.
        </p>
        <Link href="/fantasy/results">Choose a competition</Link>
      </AppShell>
    );
  const config = selected?.lineup ?? nflSeven,
    rolling = !!selected?.lineup || rules.version === sevenRules().version;
  return (
    <AppShell authenticated>
      <section className="scoring-review">
        <h1>NFL scoring rules</h1>
        <p>{selected?.name ?? "NFL scoring reference"}</p>
        <p>
          {rules.rarityVersion
            ? "Rarity scoring: the locked card multiplier applies."
            : "Legacy equal-scoring competition: all card tiers use 1.0×. Historical rules are unchanged."}
        </p>
        <p>
          <Link href="/fantasy/scoring/how-it-works?sport=nfl">
            NFL scoring and player statistics by round
          </Link>
        </p>
        <NflScoringReference savedWeights={rules.weights} />
        {selected && (
          <details>
            <summary>Complete saved competition rules</summary>
            <ScoringRulesTable
              rules={{
                ...rules,
                policy: rules.policy.filter(
                  (p) => !p.includes("live catalogue is not enabled"),
                ),
              }}
            />
          </details>
        )}
        <h2>Rarity and calculation order</h2>
        <table className="rules-rarity-table">
          <thead>
            <tr>
              <th>Rarity</th>
              <th>Multiplier</th>
              {rolling && <th>Fantasy salary</th>}
            </tr>
          </thead>
          <tbody>
            {rarities.map((r) => (
              <tr key={r}>
                <th>{rarityRule(r).label}</th>
                <td>
                  {rules.rarityVersion
                    ? (rarityRule(r).multiplierTenths / 10).toFixed(1)
                    : "1.0"}
                  ×
                </td>
                {rolling && (
                  <td>{config.salaries[r].toLocaleString("en-AU")}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Base statistical points are calculated in integer hundredths. Sum each
          player's complete round base points, then apply the saved card
          multiplier once. Round each adjusted player total to 0.01 points,
          halves away from zero, then sum the team. Negative totals are
          multiplied too: −1.25 × 1.3 = −1.63. Corrections reuse the locked
          version.
        </p>
        <h2>Team and eligibility</h2>
        <p>
          {rules.slots
            .map((s) => `${s.id}: ${s.positions.join("/")}`)
            .join(" · ")}
          . One underlying player per lineup, regardless of card rarity or
          serial. Only owned eligible cards; no automatic substitutions or
          scoring bench.
        </p>
        {rolling && (
          <p>
            {competitionNames.SALARY_CAP}:{" "}
            {config.salaryCap.toLocaleString("en-AU")} fantasy dollars; exactly
            the cap is allowed. {competitionNames.OPEN} has no salary limit.
            Each mode has its own entry; the same owned card can be used in
            both.
          </p>
        )}
        <h2>Entries, locks and transfers</h2>
        <p>
          {rules.version === sevenRules().version
            ? "All selections lock together at the round deadline. Submitted teams become visible to eligible competitors after that deadline. No replacements, new entries or withdrawals are permitted afterward."
            : rolling
              ? "New entries close at the first included kickoff. Already-entered teams may edit unlocked slots; each selected player locks permanently at their own kickoff. A started player cannot be added or moved."
              : "This legacy round uses its saved whole-lineup deadline. No changes are permitted after that deadline."}
        </p>
        <p>
          {rolling
            ? sevenTransferNotice
            : "Locked lineup ownership and scoring snapshots remain unchanged by later transfers. Existing legacy transfer restrictions apply."}
        </p>
        <h2>Missing results and corrections</h2>
        <p>
          NFL scores are post-game, not live. Missing, stale or conflicting
          statistics remain pending, not zero or DNP. Incomplete totals are
          provisional. Byes or non-participation require source evidence.
          Postponements and changed schedules require review; locked slots do
          not automatically unlock. Final results require complete verified
          statistics and the saved correction policy. Late corrections require
          audited review. Tied scores share rank; no cash prizes.
        </p>
        <p>
          <Link
            href={
              selected
                ? `/fantasy/play?competition=${selected.id}`
                : "/fantasy/play"
            }
          >
            Play
          </Link>{" "}
          ·{" "}
          <Link
            href={
              selected
                ? `/fantasy/results?competition=${selected.id}`
                : "/fantasy/results"
            }
          >
            Rankings
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
