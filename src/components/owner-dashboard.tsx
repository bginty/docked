import Link from "next/link";
import { DateTime } from "luxon";
import type { Operations } from "@/core/owner-operations";
import { ownerAlerts } from "@/core/owner-command-centre";
const time = (v: string | null) =>
  v
    ? DateTime.fromISO(v).setZone("Australia/Sydney").toFormat("d LLL, h:mm a")
    : "Not recorded";
const count = (v: number | undefined) =>
  v === undefined ? "Unavailable" : v.toLocaleString("en-AU");
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | undefined;
  detail: string;
}) {
  return (
    <article className="command-metric">
      <span>{label}</span>
      <strong>{count(value)}</strong>
      <small>{detail}</small>
    </article>
  );
}
export function OwnerDashboard({ data }: { data: Operations | null }) {
  if (!data)
    return (
      <section className="command-panel">
        <h2>Commercial reporting is not connected</h2>
        <p>
          Select Beta / test to inspect existing invited-beta records. Missing
          payment data is never shown as zero revenue.
        </p>
        <Link className="button ghost" href="/admin/operations?scope=beta">
          View beta operations
        </Link>
      </section>
    );
  const c = data.centre,
    w = data.wallet,
    alerts = ownerAlerts(data);
  const days = c?.daily ?? [],
    max = Math.max(1, ...days.map((d) => d.entries + d.packs + d.posts));
  return (
    <div className="owner-operations command-centre">
      <div className="command-status">
        <span className="command-badge">Invited beta · Test credits only</span>
        <span>Updated {time(data.generatedAt)} · Australia/Sydney</span>
      </div>
      <div className="command-kpis">
        <Metric
          label="Admitted members"
          value={data.metrics.admitted}
          detail={`${count(c?.pendingInvitations)} pending invitations`}
        />
        <Metric
          label="Active in range"
          value={c?.activeMembers}
          detail="Saved teams, opened packs or posts"
        />
        <Metric
          label="Packs opened"
          value={c?.packsOpened}
          detail="Selected period and known sport"
        />
        <Metric
          label="Test credits outstanding"
          value={w?.outstanding}
          detail={`${count(w?.reserved)} reserved · Account-wide`}
        />
      </div>
      <nav className="command-nav" aria-label="Owner sections">
        <a href="#owner-attention">Attention</a>
        <a href="#owner-activity">Activity</a>
        <a href="#owner-economy">Economy</a>
        <a href="#owner-data">Data & competitions</a>
        <a href="#owner-controls">Operations</a>
      </nav>
      <div className="command-grid">
        <section className="command-panel" id="owner-attention">
          <div className="command-heading">
            <div>
              <p className="eyebrow">EXCEPTIONS</p>
              <h2>Needs attention</h2>
            </div>
            <span className="command-badge">{alerts.length} recorded</span>
          </div>
          <p className="command-muted">
            Evidence from available sources, not a complete security or uptime
            monitor.
          </p>
          {alerts.length ? (
            <ul className="command-alerts">
              {alerts.slice(0, 8).map((a) => (
                <li key={a.id} data-severity={a.severity}>
                  <div>
                    <span className="command-severity">{a.severity}</span>
                    <time dateTime={a.at}>{time(a.at)}</time>
                  </div>
                  <h3>
                    <Link href={a.href}>{a.title}</Link>
                  </h3>
                  <p>{a.detail}</p>
                  <small>{a.status}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="command-empty">
              No exceptions in the available records.
            </p>
          )}
          {alerts.length > 8 && (
            <details>
              <summary>View {alerts.length - 8} more exceptions</summary>
              {alerts.slice(8).map((a) => (
                <p key={a.id}>
                  <Link href={a.href}>{a.title}</Link> · {time(a.at)} ·{" "}
                  {a.status}
                </p>
              ))}
            </details>
          )}
        </section>
        <section className="command-panel" id="owner-activity">
          <p className="eyebrow">ENGAGEMENT</p>
          <h2>Activity in your date range</h2>
          <div className="command-legend">
            <span>Entries {count(c?.entriesUpdated)}</span>
            <span>Packs {count(c?.packsOpened)}</span>
            <span>Posts {count(c?.posts)}</span>
          </div>
          {days.length ? (
            <>
              <svg
                className="command-chart"
                viewBox="0 0 600 150"
                role="img"
                aria-label="Daily entry, pack and post activity. Exact counts are in the daily table."
              >
                <line
                  x1="0"
                  y1="145"
                  x2="600"
                  y2="145"
                  stroke="currentColor"
                  opacity=".2"
                />
                {days.map((d, i) => {
                  const width = 600 / days.length;
                  let bottom = 145;
                  return (
                    <g key={d.day}>
                      <title>
                        {d.day}: {d.entries} entries, {d.packs} packs, {d.posts}{" "}
                        posts
                      </title>
                      {[d.entries, d.packs, d.posts].map((n, k) => {
                        const height = (n / max) * 125;
                        bottom -= height;
                        return (
                          <rect
                            key={k}
                            x={i * width + 1}
                            y={bottom}
                            width={Math.max(0.5, width - 2)}
                            height={height}
                            fill={["#238bff", "#31d0dc", "#b98bff"][k]}
                            rx="1"
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
              <div className="command-chart-dates">
                <span>{days[0].day}</span>
                <span>{days.at(-1)?.day}</span>
              </div>
              <details>
                <summary>Daily activity table</summary>
                <div
                  className="operations-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Daily activity"
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Sydney date</th>
                        <th scope="col">Entries updated</th>
                        <th scope="col">Packs opened</th>
                        <th scope="col">Posts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((d) => (
                        <tr key={d.day}>
                          <th scope="row">{d.day}</th>
                          <td>{d.entries}</td>
                          <td>{d.packs}</td>
                          <td>{d.posts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p>No daily reporting source available.</p>
          )}
          <p className="command-muted">
            Entries use their latest saved update. Activity is not login
            activity or retention.
          </p>
          <div className="command-mini">
            <span>
              New accounts{" "}
              <strong>{count(data.metrics.newRegistrations)}</strong>
            </span>
            <span>
              Suspended <strong>{count(c?.suspendedMembers)}</strong>
            </span>
          </div>
        </section>
      </div>
      <section className="command-panel" id="owner-economy">
        <div className="command-heading">
          <div>
            <p className="eyebrow">WALLET & COLLECTIBLES</p>
            <h2>Test economy</h2>
          </div>
          <Link className="button ghost" href="/fantasy/test-wallet">
            Inspect wallet records
          </Link>
        </div>
        {w ? (
          <>
            <div className="command-kpis">
              <Metric
                label="Issued"
                value={w.issued}
                detail="Lifetime test-ledger issuance"
              />
              <Metric
                label="Spent / extinguished"
                value={w.extinguished}
                detail="Excludes member-to-member movement"
              />
              <Metric
                label="Spendable"
                value={w.spendable}
                detail="Excludes holds, pending and reservations"
              />
              <Metric
                label="Reconciliation difference"
                value={w.difference}
                detail={`${w.unbalancedTransactions} unbalanced journals`}
              />
            </div>
            <div className="command-mini">
              <span>
                Pack spending <strong>{count(w.packSpend)} credits</strong>
              </span>
              <span>
                Recorded fees <strong>{count(w.fees)} credits</strong>
              </span>
              <span>
                Open listings <strong>{w.listings}</strong>
              </span>
              <span>
                Open private offers <strong>{w.pendingOffers}</strong>
              </span>
            </div>
            <details>
              <summary>Issuance categories and balance definitions</summary>
              <p>
                Wallet totals are account-wide lifetime snapshots, including
                staff. Pending: {count(w.pending)}. Reserved:{" "}
                {count(w.reserved)}. Neither is spendable.
              </p>
              {Object.entries(w.categories).map(([name, n]) => (
                <p key={name}>
                  {name}: {count(n)} outstanding test credits
                </p>
              ))}
              <p>
                Category names record provenance; they do not establish cash
                backing or redeemability.
              </p>
            </details>
          </>
        ) : (
          <p>Wallet source unavailable. No estimated balance is shown.</p>
        )}
        <div className="command-rarity">
          {c?.inventorySummary.map((r) => (
            <article key={r.tier}>
              <span>{r.tier.replaceAll("_", " ")}</span>
              <strong>{count(r.issued)}</strong>
              <small>
                {r.tier === "CORE"
                  ? "Issued · unlimited Core rules preserved"
                  : `${count(r.cap - r.issued)} unissued across recorded editions`}
              </small>
            </article>
          ))}
        </div>
        <p className="command-muted">
          Issued supply includes sealed paid-pack allocations. Unissued capacity
          does not guarantee purchasable stock.
        </p>
        <aside className="command-financial">
          <strong>Real-money reporting unavailable</strong>
          <p>
            No connected commercial receipts or settlement source. Test credits,
            simulated fees and pack spending are not revenue. Payments,
            redemption and banking remain disabled.
          </p>
        </aside>
      </section>
      <div className="command-grid" id="owner-data">
        <section className="command-panel">
          <p className="eyebrow">SPORTS DATA</p>
          <h2>Feed operations</h2>
          <dl className="command-facts">
            <div>
              <dt>Latest NFL roster observation</dt>
              <dd>{time(c?.lastRosterSync ?? null)}</dd>
            </div>
            <div>
              <dt>Weekly Core rewards</dt>
              <dd>
                {c
                  ? c.weeklyEnabled
                    ? "Database enabled · application gate also required"
                    : "Disabled"
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Commercial provider approval</dt>
              <dd>Not established by this report</dd>
            </div>
          </dl>
          <p className="command-muted">
            A roster observation is not evidence of complete scoring data or
            licensed commercial use.
          </p>
          <details>
            <summary>Worker history and job exceptions</summary>
            {c?.workerRuns.length ? (
              c.workerRuns.map((r) => (
                <p key={r.id}>
                  Run {r.id} · {r.status} · {time(r.started_at)} ·{" "}
                  {r.finished_at
                    ? `finished ${time(r.finished_at)}`
                    : "No finish recorded"}
                </p>
              ))
            ) : (
              <p>No worker runs recorded.</p>
            )}
            {c?.feedJobs.map((j) => (
              <p key={j.id}>
                {j.provider} · {j.state} · {j.attempts} attempts ·{" "}
                {j.error_code ?? "No error code"}
                <br />
                <small>Job {j.id}</small>
              </p>
            ))}
          </details>
        </section>
        <section className="command-panel">
          <div className="command-heading">
            <div>
              <p className="eyebrow">FANTASY</p>
              <h2>Competitions & deadlines</h2>
            </div>
            <Link className="button ghost" href="/fantasy/standings">
              Standings
            </Link>
          </div>
          {!data.competitions.length ? (
            <p>No competitions overlap this range.</p>
          ) : (
            <ul className="command-competitions">
              {data.competitions.map((c) => (
                <li key={c.id}>
                  <strong>{c.name}</strong>
                  <span>
                    {c.sport.toUpperCase()} · Round {c.round} · {c.entries}{" "}
                    entries
                  </span>
                  <span>
                    Lock {time(c.locks_at)} ·{" "}
                    {Date.parse(c.locks_at) <= Date.parse(data.generatedAt)
                      ? "Locked"
                      : "Upcoming"}
                  </span>
                  <small>
                    {c.scored_entries}/{c.entries} score records · Verify
                    finalisation in the competition record.
                  </small>
                </li>
              ))}
            </ul>
          )}
          <Link className="button ghost" href="/fantasy/admin">
            Competition operations
          </Link>
        </section>
      </div>
      <section className="command-panel" id="owner-controls">
        <p className="eyebrow">CONTROLLED WORKSPACES</p>
        <h2>Operate Docked</h2>
        <nav className="command-workspaces" aria-label="Operational workspaces">
          <Link href="/admin/preview-testers">
            <strong>Invitations & admission</strong>
            <span>Manage approved beta access</span>
          </Link>
          <Link href="/admin/community/reports">
            <strong>Moderation & reports</strong>
            <span>Review evidence and audited actions</span>
          </Link>
          <Link href="/fantasy/admin">
            <strong>Cards & competitions</strong>
            <span>Existing permission-controlled operations</span>
          </Link>
          <Link href="/admin/redemptions">
            <strong>Finance operations</strong>
            <span>Restricted workspace · activation remains disabled</span>
          </Link>
          <Link href="/admin/analytics">
            <strong>Consent-based analytics</strong>
            <span>Available acquisition measurements</span>
          </Link>
          <Link href="/admin">
            <strong>Staff portal</strong>
            <span>Role-specific access and MFA</span>
          </Link>
        </nav>
        <p className="command-muted">
          Each workspace rechecks server-side permissions. No direct balance,
          ownership or scarcity editing is provided here.
        </p>
      </section>
      <details className="command-panel">
        <summary>Reporting definitions, limitations & legacy inventory</summary>
        {[...(c?.limitations ?? []), ...data.limitations].map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        <p>
          Legacy day, week and month metrics use Sydney calendar boundaries, not
          rolling retention.
        </p>
        <div
          className="operations-scroll"
          tabIndex={0}
          role="region"
          aria-label="Legacy inventory integrity"
        >
          <table>
            <thead>
              <tr>
                <th>Player / edition</th>
                <th>Rarity</th>
                <th>Issued</th>
                <th>Integrity</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.map((e) => (
                <tr key={e.id}>
                  <th>
                    {e.name}
                    <small>
                      {e.sport} · {e.season}
                    </small>
                  </th>
                  <td>{e.tier}</td>
                  <td>{e.issued}</td>
                  <td>
                    {e.issued === e.cards &&
                    e.cards === e.distinct_serials &&
                    e.issued <= e.max_supply
                      ? "Reconciled"
                      : "Review required"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
