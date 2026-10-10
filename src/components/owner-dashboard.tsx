import { PrizeRegister } from "./prize-register";
import Link from "next/link";
import { DateTime } from "luxon";
import type { Operations } from "@/core/owner-operations";
const time = (v: string) =>
  DateTime.fromISO(v)
    .setZone("Australia/Sydney")
    .toFormat("d LLL yyyy, h:mm a");
const labels: Record<string, string> = {
  registered: "Registered accounts",
  admitted: "Admitted members",
  newRegistrations: "New accounts in range",
  activeToday: "Active today",
  activeWeek: "Active this week",
  activeMonth: "Active this month",
  activeInRange: "Active in date range",
  starterCards: "Starter entitlements",
  teamsEntered: "Teams entered in range",
  competitors: "Competitors in range",
  packsOpened: "Packs opened in range",
  tradeOffers: "Offers in range",
  acceptedTrades: "Trades in range",
  posts: "Posts in range",
};
export function OwnerDashboard({ data }: { data: Operations | null }) {
  return (
    <div className="owner-operations">
      <h2>What needs attention</h2>
      {!data ? (
        <p>
          No live reporting source is enabled. Select Beta / test to inspect
          isolated records.
        </p>
      ) : (
        <>
          <p>
            Updated {time(data.generatedAt)} · Australia/Sydney · beta/test only
          </p>
          <div className="operations-metrics">
            {Object.entries(data.metrics).map(([name, n]) => (
              <article key={name}>
                <span>{labels[name] ?? name}</span>
                <strong>{n}</strong>
              </article>
            ))}
          </div>
          <p>
            Entry rate in range:{" "}
            {data.metrics.admitted
              ? `${((data.metrics.competitors / data.metrics.admitted) * 100).toFixed(1)}%`
              : "No admitted members"}
            . Denominator: accepted admissions, including members yet to finish
            onboarding.
          </p>
          <h2>Competitions and deadlines</h2>
          <p>
            Recorded beta rankings are simulated. A scored timestamp alone is
            not finalisation; winners and prize approval remain unavailable.
            Tied ranks require an approved prize tie policy.
          </p>
          {!data.competitions.length ? (
            <p>No competitions in this range.</p>
          ) : (
            <div
              className="operations-scroll"
              tabIndex={0}
              role="region"
              aria-label="Competition register"
            >
              <table>
                <thead>
                  <tr>
                    <th>Competition</th>
                    <th>Deadline · Sydney</th>
                    <th>Entries</th>
                    <th>Scoring</th>
                    <th>Rules</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competitions.map((c) => (
                    <tr key={c.id}>
                      <th>
                        <Link href="/fantasy/play">{c.name}</Link>
                        <small>
                          {c.sport} · round {c.round}
                        </small>
                        <details>
                          <summary>Rankings</summary>
                          {c.rankings.length ? (
                            c.rankings.map((r) => (
                              <p key={r.member}>
                                Rank {r.rank} · member {r.member} · {r.score}{" "}
                                points
                              </p>
                            ))
                          ) : (
                            <p>Pending</p>
                          )}
                        </details>
                      </th>
                      <td>{time(c.locks_at)}</td>
                      <td>
                        {c.entries}
                        {Date.parse(c.locks_at) <= Date.now()
                          ? " · locked"
                          : " · editable"}
                      </td>
                      <td>
                        {c.scored_entries}/{c.entries} scored ·{" "}
                        {c.scored_at ? "simulated" : "pending"}
                      </td>
                      <td>{c.rules_version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2>Inventory and permanent scarcity</h2>
          <p>
            Current beta snapshot. Unissued lifetime capacity is not a promise
            of purchasable stock. Paid reservations are not configured.
          </p>
          <div
            className="operations-scroll"
            tabIndex={0}
            role="region"
            aria-label="Inventory register"
          >
            <table>
              <thead>
                <tr>
                  <th>Player / edition</th>
                  <th>Tier</th>
                  <th>Cap</th>
                  <th>Issued</th>
                  <th>Unissued</th>
                  <th>Integrity</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((e) => (
                  <tr key={e.id}>
                    <th>
                      {e.name}
                      <small>
                        {e.sport} · {e.season} · {e.id}
                      </small>
                    </th>
                    <td>{e.tier}</td>
                    <td>{e.max_supply}</td>
                    <td>{e.issued}</td>
                    <td>{e.available_lifetime_supply}</td>
                    <td>
                      {e.issued === e.cards &&
                      e.cards === e.distinct_serials &&
                      e.issued <= e.max_supply
                        ? "Reconciled"
                        : "REVIEW"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Support and moderation</h2>
          <p>
            <Link href="/admin/community/reports">
              {data.reports.length} open reports
            </Link>{" "}
            · {data.emailFailures} failed outbox messages in range.
          </p>
          {data.reports.map((r) => (
            <p key={r.id}>
              <Link href="/admin/community/reports">Report {r.id}</Link> ·{" "}
              {time(r.created_at)}
            </p>
          ))}
          <details>
            <summary>Metric definitions and limits</summary>
            {data.limitations.map((l) => (
              <p key={l}>{l}</p>
            ))}
            <p>
              Today, week and month use Sydney calendar boundaries,
              independently of the selected custom range. Owner/staff and the
              automated official profile are excluded unless staff is explicitly
              included. Invite acceptance is required for admitted counts;
              registration alone does not grant access. Retention/return cohorts
              and the full funnel require additional event history; none is
              backfilled.
            </p>
          </details>
        </>
      )}
      <h2>Payment operations</h2>
      <p>
        Not configured. No live orders, confirmed receipts, refunds, disputes,
        bank reconciliation or paid deliveries are available. Premium A$49 and
        Elite A$99 products remain disabled. Test ledger balances are not
        payment receipts or profit.
      </p>
      <PrizeRegister
        now={data?.generatedAt ?? new Date().toISOString()}
        start=""
        end=""
      />
      <h2>Identity and withdrawals</h2>
      <p>
        Not configured. Real withdrawals are disabled. No raw identity documents
        are collected here. Gameplay points, pack purchases and simulated
        balances are not withdrawable funds.
      </p>
      <h2>Data-feed health</h2>
      <p>
        EPL / NFL: no authorised scoring feed connected. AFL live scoring
        unavailable. Mapping completeness, last imports and stale-score alerts
        need an active provider. Missing statistics remain pending.
      </p>
    </div>
  );
}
