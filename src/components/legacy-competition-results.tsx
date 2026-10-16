"use client";
import { competitionNames } from "@/core/competition-display";
import { useState } from "react";
import Link from "next/link";
import type { ReviewRound } from "@/core/competition-review";
import { roundStatus } from "@/core/competition-review";
import type { PostgameView, NflStanding } from "@/server/postgame-results";
import { PostgameResults } from "./postgame-results";
import { LocalDateTime } from "./local-date-time";
export function LegacyCompetitionResults({
  rounds,
  standings,
  records,
  initial,
}: {
  rounds: ReviewRound[];
  standings: NflStanding[];
  records: PostgameView[];
  initial?: string;
}) {
  const [mode, setMode] = useState(
      rounds.find((r) => r.id === initial)?.mode ?? "LEGACY",
    ),
    [chosen, setChosen] = useState(initial ?? "");
  const options = rounds.filter((r) => r.mode === mode),
    r = options.find((r) => r.id === chosen) ?? options[0];
  const scoredRows =
    standings.find((s) => s.competitionId === r?.id)?.rows ?? [];
  // An accepted entry exists before the collector creates a scoring row.
  // Show the viewer's own confirmed entry without inventing a rank or zero.
  const rows =
    r?.entered && !scoredRows.some((x) => x.isMe)
      ? [
          ...scoredRows,
          {
            name: "You",
            isMe: true,
            rank: null,
            points: null,
            status:
              Date.parse(r.closesAt) > Date.now()
                ? "Entered · awaiting game"
                : "Entered · awaiting statistics",
          },
        ]
      : scoredRows;
  return (
    <section className="scoring-review">
      <h1>NFL results & leaderboards</h1>
      <p>Post-game scoring · free test competitions · no cash prizes</p>
      <label>
        Competition mode
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setChosen("");
          }}
        >
          <option value="SALARY_CAP">{competitionNames.SALARY_CAP}</option>
          <option value="OPEN">{competitionNames.OPEN}</option>
          <option value="LEGACY">Legacy competitions · saved rules</option>
        </select>
      </label>
      <label>
        NFL season / week
        <select value={r?.id ?? ""} onChange={(e) => setChosen(e.target.value)}>
          {!options.length && <option value="">No rounds available</option>}
          {options.map((x) => (
            <option value={x.id} key={x.id}>
              {x.season} · Week {x.week} · {x.name}
            </option>
          ))}
        </select>
      </label>
      {!r ? (
        <p>
          No{" "}
          {mode === "LEGACY"
            ? "legacy"
            : mode === "OPEN"
              ? competitionNames.OPEN
              : competitionNames.SALARY_CAP}{" "}
          rounds are available.
        </p>
      ) : (
        <article className="scoring-team">
          <h2>{r.name}</h2>
          <p>
            {r.season} · Week {r.week} · {r.entryCount} entries
            {r.entered ? " · You are entered" : ""}
          </p>
          <p role="status">
            {roundStatus(
              r,
              rows.some((x) => x.points !== null),
            )}
          </p>
          <p>
            Entry deadline: <LocalDateTime value={r.closesAt} />
          </p>
          <p>
            {r.updatedAt ? (
              <>
                Scoring record updated <LocalDateTime value={r.updatedAt} />.
                This is not confirmation of a fresh source download.
              </>
            ) : (
              "No scoring update available yet."
            )}
          </p>
          <Link href={`/fantasy/scoring/how-it-works?competition=${r.id}`}>
            Scoring rules
          </Link>{" "}
          · <Link href={`/fantasy/play?competition=${r.id}`}>View team</Link>
          {!r.visible ? (
            <p>Standings are under operator review.</p>
          ) : rows.length ? (
            <table className="competition-standings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Member</th>
                  <th>Adjusted points</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x, i) => (
                  <tr key={i} className={x.isMe ? "current-member" : ""}>
                    <td>{x.rank ?? "Pending"}</td>
                    <th>
                      {x.name}
                      {x.isMe ? " · Your team" : ""}
                    </th>
                    <td>
                      {x.points === null
                        ? "Awaiting statistics"
                        : Number(x.points).toFixed(2)}
                    </td>
                    <td>{x.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              {r.entryCount
                ? "Entries are recorded. Rankings will appear when the scoring pipeline has results; no final zero has been assigned."
                : "Be the first to enter before the deadline. An empty round is not a completed result."}
            </p>
          )}
          <PostgameResults
            records={records.filter((x) => x.id === r.streamId)}
          />
        </article>
      )}
      <Link href="/fantasy/play">Back to Play</Link>
    </section>
  );
}
