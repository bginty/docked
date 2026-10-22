import Link from "next/link";
export const metadata = {
  title: "Roster sources | Docked",
  robots: { index: false, follow: false },
};
export default function RosterSources() {
  return (
    <main className="page-shell">
      <h1>Real-player beta rosters</h1>
      <p>
        NBA, AFL and NRL beta cards use real player names, teams and positions
        checked against Wikipedia roster lists and player profiles on 23 October
        2026 (Sydney time). Conflicting teams, unsupported positions and
        unresolved identities are excluded.
      </p>
      <p>
        This is a dated roster snapshot for private testing. It does not confirm
        match selection, injury status or a commercial player-card licence. Test
        inventory and serials are separate from permanent collectibles. Real
        game statistics are not connected.
      </p>
      <p>
        Wikipedia contributors provide the roster facts under{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          Creative Commons Attribution–ShareAlike 4.0
        </a>
        . Docked has selected facts, normalised club aliases and mapped
        supported positions. The adapted dataset is available under the same
        licence, with source links, revisions and verification timestamps for
        every player.
      </p>
      <p>
        <a
          href="/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json"
          download
        >
          Download the attributed roster dataset
        </a>
      </p>
      <ul>
        <li>NBA: 517 players across 30 teams.</li>
        <li>AFL: 545 players across 18 clubs.</li>
        <li>NRL: 337 players across 17 clubs.</li>
      </ul>
      <p>
        NRL uses the existing provisional beta positions. Players verified only
        as hookers are excluded because that format has no approved dedicated
        hooker slot. Three NRL clubs use their latest retained 2026 squad
        revision, checked against current player profiles; next-season transfers
        are not treated as current membership.
      </p>
      <p>
        Card frames and generic uniform illustrations are Docked designs. No
        Wikipedia images, team logos or player photographs are used. Neither the
        leagues nor Wikipedia endorse this beta.
      </p>
      <Link className="button" href="/fantasy/cards">
        Back to Cards
      </Link>
    </main>
  );
}
