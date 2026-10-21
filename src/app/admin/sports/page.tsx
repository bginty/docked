import { requireRole } from "@/server/auth";
import { AdminShell } from "@/components/admin-shell";
import { adminDisplayName } from "@/server/admin-display-name";
import { SportSandbox } from "@/components/sport-sandbox";
import { sportSandbox } from "@/server/sport-sandbox";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
import Link from "next/link";
import { assertSportSandbox, type SandboxState } from "@/core/sport-sandbox";
import {
  sportConfigurations,
  sportActivationBlockers,
} from "@/core/sport-configuration";
import {
  sportEventRules,
  sportScoringReferences,
} from "@/core/sport-event-rules";
import { scoringRows } from "@/core/scoring-release";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Multi-sport readiness · Docked",
  robots: { index: false, follow: false },
};
export default async function SportsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  let who;
  try {
    who = await requireRole(["owner", "admin"]);
  } catch (e) {
    const kind = memberAccessFailure(e);
    return (
      <FantasyLoadError
        authRequired={kind === "authentication"}
        mfaRequired={kind === "mfa"}
        permissionDenied={kind === "permission"}
      />
    );
  }
  let state: SandboxState | null = null,
    problem = "",
    enabled = false;
  try {
    assertSportSandbox();
    enabled = true;
  } catch {
    /* Production fails closed. */
  }
  if (enabled) {
    try {
      state = (await sportSandbox((await searchParams).sport ?? "afl")).state;
    } catch {
      problem =
        "Sandbox data could not load. Check the isolated database migration and staff allowlist, then retry.";
    }
  }
  return (
    <AdminShell
      role={who.role}
      displayName={await adminDisplayName(who)}
      active="competitions"
    >
      {state ? (
        <SportSandbox initial={state} />
      ) : (
        <section className="admin-workspace">
          <h1>Multi-sport readiness</h1>
          <p>
            AFL 22-player testing comes first. New sports remain unavailable for
            live play until their data, rules and issuance approvals are
            complete.
          </p>
          {problem ? (
            <p role="alert">
              {problem} <Link href="/admin/sports">Retry</Link>
            </p>
          ) : (
            <p className="notice">
              The team laboratory requires an explicitly enabled, isolated
              Preview environment. It cannot run against member assets or the
              Production database.
            </p>
          )}
          <div className="admin-records">
            {Object.values(sportConfigurations)
              .filter((s) => s.id !== "nfl")
              .map((s) => (
                <article key={s.id} className="admin-workspace-panel">
                  <h2>
                    {s.label} · {s.slots.length} players
                  </h2>
                  <p>
                    {s.groups
                      .map((g) => `${g.slots.length} ${g.label}`)
                      .join(" · ")}
                  </p>
                  <p>
                    {s.formatStatus === "proposal"
                      ? "Proposed format — approval required"
                      : "Existing or approved lineup format"}
                  </p>
                  <details>
                    <summary>Scoring and scraper fields</summary>
                    <p>
                      Base points from raw statistics. Saved rounds retain their
                      own rules.
                    </p>
                    <p>{s.scoringVersion}</p>
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Action</th>
                          <th scope="col">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoringRows(
                          sportEventRules(
                            s.id === "football"
                              ? "epl"
                              : (s.id as "afl" | "nrl" | "basketball"),
                          ),
                        ).map((r) => (
                          <tr key={r.action}>
                            <td>{r.action}</td>
                            <td>{r.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      Owner-managed feeds are supported. A source must supply
                      verified player mappings, fixtures and every required
                      statistic before scoring can run.
                    </p>
                    <a
                      href={
                        sportScoringReferences[
                          s.id === "football"
                            ? "epl"
                            : (s.id as "afl" | "nrl" | "basketball")
                        ]
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Scoring reference
                    </a>
                  </details>
                  <details>
                    <summary>Required before activation</summary>
                    <ul>
                      {sportActivationBlockers(s).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </details>
                </article>
              ))}
          </div>
          <p>
            Roster evidence can be reviewed offline with the supplied review
            command. A successful review never issues cards or activates a
            competition.
          </p>
        </section>
      )}
      <Link className="button ghost" href="/admin/workspace/competitions">
        Back to competitions
      </Link>
    </AdminShell>
  );
}
