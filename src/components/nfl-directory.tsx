import Link from "next/link";
import { nflTeams } from "@/content/nfl-teams";

export function NflDirectory() {
  return (
    <section className="sport-reading" aria-labelledby="nfl-directory-title">
      <p className="eyebrow">AMERICAN FOOTBALL · NFL</p>
      <h2 id="nfl-directory-title">32 teams. One community.</h2>
      <p>
        Discuss the games and share your analysis. Member opinions are not
        verified Docked betting edges.
      </p>
      <div className="actions">
        <Link className="button" href="/feed?tab=latest&sport=nfl">
          NFL conversations
        </Link>
        <Link className="button ghost" href="/edges?view=upcoming&sport=nfl">
          NFL fixtures & coverage
        </Link>
        <Link className="button ghost" href="/compose?sport=nfl">
          Write about NFL
        </Link>
      </div>
      <p className="small-note">
        Live schedules, results and prices require an approved connected feed.
        No NFL market settlement or official predictions are enabled. Team names
        identify franchises; Docked is not affiliated with the NFL.
      </p>
      <div className="sport-reading-grid">
        {(["AFC", "NFC"] as const).flatMap((conference) =>
          (["East", "North", "South", "West"] as const).map((division) => (
            <section
              key={`${conference}-${division}`}
              aria-label={`${conference} ${division}`}
            >
              <h3>
                {conference} {division}
              </h3>
              <ul>
                {nflTeams
                  .filter(
                    (team) =>
                      team.conference === conference &&
                      team.division === division,
                  )
                  .map((team) => (
                    <li key={team.id}>{team.name}</li>
                  ))}
              </ul>
            </section>
          )),
        )}
      </div>
    </section>
  );
}
