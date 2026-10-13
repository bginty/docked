import Link from "next/link";
import { redirect } from "next/navigation";
import { fantasyRequest } from "@/server/fantasy";
import { AppShell } from "@/components/app-shell";
import { rulesets, nflRarityRules } from "@/core/scoring-v1";
import { sevenRules, nflSeven, sevenTransferNotice } from "@/core/nfl-seven";
import { rarities, rarityRule } from "@/core/card-rarity";
import { ScoringRulesTable } from "@/components/scoring-rules-table";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "NFL scoring rules",
  robots: { index: false, follow: false },
};
export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string; version?: string }>;
}) {
  const query = await searchParams;
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
  const versions = [sevenRules(), nflRarityRules(), rulesets.nfl];
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
        <p>
          {selected?.name ?? "NFL scoring reference"} · {rules.version}
        </p>
        <p>
          {rules.rarityVersion
            ? "Rarity scoring: the locked card multiplier applies."
            : "Legacy equal-scoring competition: all card tiers use 1.0×. Historical rules are unchanged."}
        </p>
        <form>
          <label>
            Competition / version
            <select name="competition" defaultValue={selected?.id ?? ""}>
              <option value="">Current seven-player reference</option>
              {rounds.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name} · {r.season}
                </option>
              ))}
            </select>
          </label>
          <button>View saved rules</button>
        </form>
        <ScoringRulesTable
          rules={{
            ...rules,
            policy: rules.policy.filter(
              (p) => !p.includes("live catalogue is not enabled"),
            ),
          }}
        />
        <h2>Rarity and calculation order</h2>
        <table>
          <thead>
            <tr>
              <th>Rarity</th>
              <th>Multiplier in this ruleset</th>
              {rolling && <th>Salary Cap salary</th>}
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
            Salary Cap: {config.salaryCap.toLocaleString("en-AU")} fantasy
            dollars; exactly the cap is allowed. Open has no salary limit. These
            budgets never debit Docked Credits. Each mode has its own entry; the
            same owned card can be used in both.
          </p>
        )}
        <h2>Entries, locks and transfers</h2>
        <p>
          {rolling
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
            Results & leaderboards
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
