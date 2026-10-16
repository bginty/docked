"use client";
import { competitionNames } from "@/core/competition-display";
import { useState } from "react";
import type { MemberTestView } from "@/core/member-test-wallet";
import { rarityRule, rarities } from "@/core/card-rarity";
export function EconomyCatalogue({
  pool,
  owner,
}: {
  pool: MemberTestView["pool"];
  owner: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = pool.filter((p) =>
    [p.name, p.team, p.position]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <details className="economy-catalogue">
      <summary>
        Disclosed player pool and lifetime supply ({pool.length})
      </summary>
      <p>
        NFL test inventory only. Active players with fresh status are eligible.
        An unavailable or stale player is excluded without changing cards
        already owned. No player photos or club logos are licensed or sold here.
      </p>
      <label>
        Find player, team or position
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
        />
      </label>
      <p>
        {filtered.length} matches · showing up to 30. Refine your search to
        inspect another player.
      </p>
      {filtered.slice(0, 30).map((p) => (
        <details key={p.id}>
          <summary>
            {p.name} · {p.position} · {p.team} ·{" "}
            {!p.fresh ? "status stale" : p.status}
          </summary>
          <div className="economy-table">
            <table>
              <caption>{p.name} · permanent test allocation</caption>
              <thead>
                <tr>
                  <th>Rarity</th>
                  <th>Multiplier</th>
                  <th>Cap</th>
                  <th>Issued</th>
                  <th>Reserved</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {p.supply.map((r) => (
                  <tr key={r.rarity}>
                    <td>{rarityRule(r.rarity).label}</td>
                    <td>{rarityRule(r.rarity).multiplierTenths / 10}×</td>
                    <td>{r.cap}</td>
                    <td>{r.issued}</td>
                    <td>{r.reserved}</td>
                    <td>{r.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Free Core cards have no finite cap. Unopened paid-with-test-credit
            packs are already issued; they do not appear as reservations.
          </p>
        </details>
      ))}
      <details>
        <summary>New rarity scoring rules</summary>
        <p>
          {competitionNames.SALARY_CAP}, {competitionNames.OPEN} and explicitly labelled rarity test competitions
          apply these multipliers. The existing free friends round retains its
          original scoring. Each complete player base score, including negative
          scores, is multiplied once and rounded to 0.01 points, halves away
          from zero. Locked rules survive transfers and corrections.
        </p>
        <table>
          <thead>
            <tr>
              <th>Rarity</th>
              <th>Multiplier</th>
            </tr>
          </thead>
          <tbody>
            {rarities.map((r) => (
              <tr key={r}>
                <td>{rarityRule(r).label}</td>
                <td>{rarityRule(r).multiplierTenths / 10}×</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Example calculation only: −1.25 base points × 1.3 Ultra Rare = −1.63
          points. The multiplier increases negative scores too.
        </p>
      </details>
      {owner && (
        <p>
          Owner controls cannot increase caps, replace identities or change
          serials. Product changes require a new immutable configuration and
          audited operator deployment. Unknown mappings require reconciliation.
        </p>
      )}
    </details>
  );
}
