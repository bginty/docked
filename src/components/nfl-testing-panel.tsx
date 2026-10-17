"use client";
import { useState } from "react";
import type { NflTestingReport } from "../server/nfl-testing-report";
const points = (v: number | null) => (v === null ? "—" : (v / 100).toFixed(2));
const timestamp = (v: number | null) =>
  v === null ? "Unavailable" : new Date(v * 1000).toLocaleString();
export function NflTestingPanel({ report }: { report: NflTestingReport }) {
  const [selected, setSelected] = useState(report.players[0]?.id ?? ""),
    [season, setSeason] = useState("");
  const player = report.players.find((p) => p.id === selected),
    period =
      player?.seasons.find((s) => s.key === season) ?? player?.seasons[0];
  const rows =
    player?.history.filter(
      (r) => `${r.season}:${r.seasonType}` === period?.key,
    ) ?? [];
  return (
    <section className="nfl-testing-panel">
      <header>
        <p className="small-note">OWNER OPERATIONS · ISOLATED TESTING</p>
        <h1>NFL postgame feed</h1>
        <p>{report.health}</p>
        <p>
          Player performance only. Historical statistics do not award member
          competition points.
        </p>
      </header>
      <div className="nfl-testing-metrics">
        {[
          ["Player-game records", report.rawRecords],
          ["Incomplete games", report.incompleteGames],
          ["Unmapped players", report.unmappedPlayers],
          ["Recalculation work", report.pending],
          ["Revised records", report.corrections],
        ].map(([name, value]) => (
          <article key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <p className="small-note">
        Last successful sync:{" "}
        {report.lastSuccess
          ? new Date(report.lastSuccess).toLocaleString()
          : "Not synced"}
        . This is an operational check, not a source correction.
      </p>
      <section className="fantasy-panel">
        <h2>Player performance</h2>
        <div className="nfl-testing-filters">
          <label>
            Player
            <select
              aria-label="Player"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setSeason("");
              }}
            >
              {report.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Season / type
            <select
              aria-label="Season / type"
              value={period?.key ?? ""}
              onChange={(e) => setSeason(e.target.value)}
            >
              {player?.seasons.map((s) => (
                <option key={s.key}>{s.key}</option>
              ))}
            </select>
          </label>
        </div>
        {!player ? (
          <p>
            Awaiting reviewed player mappings. No identity is inferred from a
            name.
          </p>
        ) : (
          <>
            <h3>{player.name}</h3>
            <p>
              <strong>{points(period?.points ?? null)}</strong> base points from{" "}
              {period?.included ?? 0} available player-games ·{" "}
              {period?.observed ?? 0} observed.
            </p>
            <p className="small-note">
              {period?.complete
                ? "All observed player records available"
                : "Incomplete season subtotal"}
              . Observed games only; missing appearances are not zero or DNP.
              Game-level gaps still block competition settlement.
            </p>
            <div
              className="nfl-testing-trend"
              role="group"
              tabIndex={0}
              aria-label="Weekly base score trend; missing scores shown as pending"
            >
              {period?.weeks
                .slice()
                .reverse()
                .map((w) => (
                  <div key={w.week}>
                    <span>W{w.week}</span>
                    <strong>{points(w.points)}</strong>
                    {w.points !== null && (
                      <meter
                        min={Math.min(
                          0,
                          ...period.weeks.map((v) => v.points ?? 0),
                        )}
                        max={Math.max(
                          100,
                          ...period.weeks.map((v) => v.points ?? 0),
                        )}
                        value={w.points ?? 0}
                        aria-label={`Week ${w.week}: ${w.points === null ? "pending" : points(w.points)}`}
                      />
                    )}
                  </div>
                ))}
            </div>
            <div
              className="nfl-testing-table"
              tabIndex={0}
              role="region"
              aria-label="Scrollable player results"
            >
              <table>
                <caption>
                  Round-by-round player history · newest game first
                </caption>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Base points</th>
                    <th>Availability</th>
                    <th>Freshness</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.game}>
                      <td>{r.week}</td>
                      <td>
                        {points(r.points)}
                        {r.points === null && r.retainedPoints !== null && (
                          <small>
                            {" "}
                            Last known: {points(r.retainedPoints)} · excluded
                            from totals
                          </small>
                        )}
                      </td>
                      <td>
                        {r.status}
                        {r.stale ? " · Stale" : ""}
                        {!r.competitionReady && r.points !== null
                          ? " · Game incomplete"
                          : ""}
                      </td>
                      <td>
                        Stats last retrieved: {timestamp(r.retrievedAt)}
                        <br />
                        Source updated: {timestamp(r.sourceUpdatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small-note">
              Source updated is the season-dataset publication time, not a
              player event time.
            </p>
          </>
        )}
        <details>
          <summary>Testing scoring configuration</summary>
          <p>{report.version}</p>
          <p>
            Full PPR · Passing .04/yard, TD 4, interception −2;
            rushing/receiving .1/yard, TD 6; two-point conversions 2; fumbles
            lost −2 once. Return/recovery TDs are outside this version. Existing
            competition versions are unchanged.
          </p>
        </details>
      </section>
      <details className="fantasy-panel">
        <summary>Incomplete games and mapping review</summary>
        <p>
          {report.unmappedPlayers} observed canonical players have no reviewed
          Docked mapping. Non-offensive positions are retained as raw records
          and are not fantasy-eligible.
        </p>
        <ul>
          {report.games
            .filter((g) => g.status === "incomplete")
            .map((g) => (
              <li key={g.id}>
                {g.season} · NFL week {g.week} · {g.id} · {g.records} known
                records
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
}
