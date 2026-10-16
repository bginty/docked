import Link from "next/link";
import type { ReactNode } from "react";
import type { Operations } from "@/core/owner-operations";
import type {
  DashboardMetric,
  OwnerReferenceData,
} from "@/core/owner-reference-data";
import { AdminIcon } from "./admin-icon";
import { OwnerPeriod } from "./owner-period";
import { PackArtwork } from "./pack-artwork";
import { OwnerOperationsDetail } from "./owner-operations-detail";
import { OwnerDetailDisclosure } from "./owner-detail-disclosure";
import { OwnerHealthCheck } from "./owner-health-check";
import { CollectibleFace } from "./collectible-face";
function activityAge(at: string, generatedAt: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(generatedAt) - Date.parse(at)) / 60000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
const number = (v: number | null | undefined) =>
  v == null ? "Unavailable" : v.toLocaleString("en-AU");
function Change({ value }: { value: number | null | undefined }) {
  return (
    <span
      className={`owner-change ${value == null || value === 0 ? "is-neutral" : value < 0 ? "is-negative" : ""}`}
    >
      {value == null
        ? "Comparison unavailable"
        : `${value === 0 ? "" : value > 0 ? "↑ " : "↓ "}${Math.abs(value).toFixed(1)}%`}
    </span>
  );
}
function Title({ children, href }: { children: ReactNode; href?: string }) {
  return (
    <div className="owner-panel-title">
      <h2>{children}</h2>
      {href && <Link href={href}>View all</Link>}
    </div>
  );
}
function Kpi({
  label,
  metric,
  icon,
  colour,
}: {
  label: string;
  metric?: DashboardMetric;
  icon: string;
  colour: string;
}) {
  return (
    <article className={`owner-kpi tone-${colour}`}>
      <span className="owner-kpi-icon">
        <AdminIcon name={icon} />
      </span>
      <div>
        <span>{label}</span>
        <strong
          className={metric?.current == null ? "is-unavailable" : undefined}
        >
          {metric?.unit === "AUD" && metric.current != null ? "$" : ""}
          {number(metric?.current)}
        </strong>
        <Change value={metric?.changePercent} />
        <small title={metric?.detail}>
          {metric?.unit === "AUD" ? "Settled cash only" : "vs. previous period"}
        </small>
      </div>
    </article>
  );
}
function RegistrationChart({
  rows,
  cumulative = false,
}: {
  rows: OwnerReferenceData["registrations"];
  cumulative?: boolean;
}) {
  if (!rows.length)
    return (
      <p className="owner-chart-empty">No registration data for this period.</p>
    );
  const max =
    Math.ceil(
      Math.max(
        2,
        ...rows.map((r) => (cumulative ? r.cumulative : r.registrations)),
      ) / 2,
    ) * 2;
  const points = rows
    .map(
      (r, i) =>
        `${40 + (i * 340) / Math.max(1, rows.length - 1)},${125 - ((cumulative ? r.cumulative : r.registrations) * 110) / max}`,
    )
    .join(" ");
  return (
    <>
      <svg
        className="owner-chart"
        viewBox="0 0 400 155"
        role="img"
        aria-label={
          cumulative
            ? "Cumulative registered members, zero baseline"
            : "Daily registrations, zero baseline"
        }
      >
        <defs>
          <linearGradient id="owner-growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#147aff" stopOpacity=".45" />
            <stop offset="1" stopColor="#147aff" stopOpacity=".03" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1="38" x2="385" y1={125 - f * 110} y2={125 - f * 110} />
            <text x="30" y={129 - f * 110} textAnchor="end">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {cumulative ? (
          <>
            <polygon
              points={`40,125 ${points} 380,125`}
              fill="url(#owner-growth-fill)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#268bff"
              strokeWidth="2.5"
            />
          </>
        ) : (
          rows.map((r, i) => (
            <rect
              key={r.day}
              x={40 + (i * 340) / rows.length}
              y={125 - (r.registrations * 110) / max}
              width={Math.max(1, 270 / rows.length)}
              height={(r.registrations * 110) / max}
              fill="#1685ff"
            />
          ))
        )}
        {[0, Math.floor((rows.length - 1) / 2), rows.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text
              key={i}
              x={40 + (i * 340) / Math.max(1, rows.length - 1)}
              y="148"
              textAnchor={
                i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"
              }
            >
              {rows[i].day.slice(5)}
            </text>
          ))}
      </svg>
      <details className="owner-chart-data">
        <summary>Chart data</summary>
        <table>
          <caption>
            {cumulative ? "Cumulative members" : "Daily registrations"}
          </caption>
          <thead>
            <tr>
              <th>Date · Sydney</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>{r.day}</td>
                <td>{cumulative ? r.cumulative : r.registrations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
export function OwnerDashboard({
  data,
  displayName = "Admin",
  siteUrl = "/",
  period = "30",
}: {
  data: Operations | null;
  displayName?: string;
  siteUrl?: string;
  period?: string;
}) {
  const report = data?.reference;
  const healthy = ["database", "api", "web", "android", "jobs", "email"].every(
    (id) =>
      report?.health.some((item) => item.id === id && item.status === "passed"),
  );
  return (
    <div className="owner-reference-dashboard">
      <section className="owner-welcome">
        <img src="/brand/docked/admin/three-sport-banner.webp" alt="" />
        <div>
          <h1>
            Welcome back, {displayName} <span aria-hidden="true">👋</span>
          </h1>
          <p>Here’s what’s happening on Docked today.</p>
        </div>
        <div className="owner-banner-tagline" aria-hidden="true">
          COLLECT.
          <br />
          BUILD.
          <br />
          COMPETE.
        </div>
        <div className="owner-live">
          <a
            className="admin-control"
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
          >
            View Live Site <AdminIcon name="external" />
          </a>
          <span
            className={healthy ? "owner-status passed" : "owner-status unknown"}
          >
            {healthy ? "All Systems Operational" : "System checks incomplete"}
          </span>
        </div>
      </section>
      <section className="owner-reference-kpis" aria-label="Executive metrics">
        <Kpi
          label="Total Users"
          metric={report?.kpis.users}
          icon="users"
          colour="blue"
        />
        <Kpi
          label="Packs Sold"
          metric={report?.kpis.packs}
          icon="pack"
          colour="purple"
        />
        <Kpi
          label="Revenue (AUD)"
          metric={report?.kpis.revenue}
          icon="wallet"
          colour="green"
        />
        <Kpi
          label="Marketplace Trades"
          metric={report?.kpis.trades}
          icon="market"
          colour="cyan"
        />
        <Kpi
          label="Total Cards in Circulation"
          metric={report?.kpis.circulation}
          icon="cards"
          colour="violet"
        />
      </section>
      <section className="owner-reference-charts" aria-label="Analytics">
        <article className="owner-reference-panel">
          <div className="owner-panel-title">
            <h2>Revenue Overview</h2>
            <OwnerPeriod label="Revenue reporting period" value={period} />
          </div>
          <div className="owner-chart-total">
            {number(report?.kpis.revenue.current)}{" "}
            <Change value={report?.kpis.revenue.changePercent} />
          </div>
          <div className="owner-revenue-empty">
            <AdminIcon name="chart" />
            <p>Settled AUD reporting is not connected.</p>
            <small>Beta credits are excluded from revenue.</small>
          </div>
          <div className="owner-chart-legend">
            <span>Pack sales</span>
            <span>Marketplace fees</span>
            <span>Other approved revenue</span>
          </div>
        </article>
        <article className="owner-reference-panel">
          <div className="owner-panel-title">
            <h2>New Users</h2>
            <OwnerPeriod label="New users reporting period" value={period} />
          </div>
          <div className="owner-chart-total">
            {number(report?.newUsers.current)}{" "}
            <Change value={report?.newUsers.changePercent} />
          </div>
          <RegistrationChart rows={report?.registrations ?? []} />
        </article>
        <article className="owner-reference-panel">
          <div className="owner-panel-title">
            <h2>User Growth</h2>
            <OwnerPeriod label="User growth reporting period" value={period} />
          </div>
          <div className="owner-chart-total">
            {number(report?.registrations.at(-1)?.cumulative)}
          </div>
          <RegistrationChart rows={report?.registrations ?? []} cumulative />
        </article>
      </section>
      <section
        className="owner-reference-middle"
        aria-label="Commercial and member activity"
      >
        <article className="owner-reference-panel">
          <Title href="/admin/workspace/packs">Pack Sales</Title>
          <div className="owner-row-head">
            <span>Pack</span>
            <span>Sold</span>
            <span>Test credits</span>
          </div>
          {report?.packSales.length ? (
            report.packSales.slice(0, 3).map((pack) => (
              <Link
                className="owner-pack-row"
                href={`/admin/workspace/packs?record=${encodeURIComponent(pack.id)}`}
                key={pack.id}
              >
                <PackArtwork
                  name={pack.name}
                  premium={pack.type === "PREMIUM"}
                  compact
                />
                <div>
                  <strong>{pack.name}</strong>
                  <small>
                    {pack.cards} cards · {pack.sport.toUpperCase()}
                  </small>
                </div>
                <b>{number(pack.sold)}</b>
                <span>{number(pack.testCredits)}</span>
              </Link>
            ))
          ) : (
            <p className="owner-panel-empty">
              No completed pack purchases in this reporting scope.
            </p>
          )}
        </article>
        <article className="owner-reference-panel">
          <Title href="/admin/workspace/marketplace">
            Top Cards <small>(selected period)</small>
          </Title>
          {report?.topCards.length ? (
            report.topCards.slice(0, 5).map((card, i) => (
              <Link
                className="owner-card-row"
                href={`/admin/workspace/cards?record=${encodeURIComponent(card.id)}`}
                key={card.id}
              >
                <b className="owner-rank">{i + 1}</b>
                <span className="owner-card-glyph" aria-hidden="true">
                  <CollectibleFace
                    card={
                      card.thumbnail ?? {
                        name: card.name,
                        position: card.position,
                        sport: card.sport,
                        tier: card.rarity,
                      }
                    }
                    variant="compact"
                  />
                </span>
                <div>
                  <strong>{card.name}</strong>
                  <small>
                    {card.sport.toUpperCase()} · {card.position}
                  </small>
                </div>
                <small>{card.sales} sales</small>
                <span>
                  {number(card.testCredits)}
                  <small>test credits</small>
                </span>
              </Link>
            ))
          ) : (
            <p className="owner-panel-empty">
              No completed card sales in this reporting scope.
            </p>
          )}
        </article>
        <article className="owner-reference-panel">
          <Title href="/admin/workspace/analytics">Recent Activity</Title>
          {report?.recent.length ? (
            report.recent.slice(0, 5).map((item) => (
              <Link
                className="owner-activity-row"
                href={item.href}
                key={item.id}
              >
                <span
                  className={`owner-activity-icon tone-${item.kind === "report" ? "red" : "blue"}`}
                >
                  <AdminIcon
                    name={
                      item.kind === "registration"
                        ? "users"
                        : item.kind === "pack"
                          ? "pack"
                          : item.kind === "report"
                            ? "shield"
                            : "file"
                    }
                  />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
                <time dateTime={item.at}>
                  {activityAge(item.at, report.generatedAt)}
                </time>
              </Link>
            ))
          ) : (
            <p className="owner-panel-empty">
              No recent activity is available.
            </p>
          )}
        </article>
      </section>
      <section
        className="owner-reference-bottom"
        aria-label="Operational controls"
      >
        <article className="owner-reference-panel">
          <Title>Platform Health</Title>
          <div className="owner-health-grid">
            {(
              report?.health ??
              [
                "Database",
                "API",
                "Web application",
                "Android application",
                "Background jobs",
                "Email service",
              ].map((label) => ({
                id: label,
                label,
                status: "unknown",
                detail: "Check unavailable",
                href: "/admin/workspace/settings",
              }))
            ).map((item) => (
              <Link key={item.id} href={item.href} title={item.detail}>
                <span
                  className={`owner-status-dot ${item.status}`}
                  aria-label={item.status}
                >
                  {item.status === "passed" ? "✓" : "?"}
                </span>
                {item.label}
              </Link>
            ))}
          </div>
          <details id="owner-health-evidence">
            <summary>Check evidence</summary>
            {report?.health.map((item) => (
              <p key={item.id}>
                <strong>{item.label}</strong>: {item.detail}
              </p>
            ))}
            <OwnerHealthCheck />
          </details>
        </article>
        <article className="owner-reference-panel">
          <Title href="/admin/workspace/moderation">Moderation Queue</Title>
          <div className="owner-moderation-grid">
            {(
              [
                { key: "content", name: "Reported Content", icon: "shield" },
                { key: "members", name: "User Reviews", icon: "users" },
                { key: "listings", name: "Card Listings", icon: "cards" },
              ] as const
            ).map((item) => (
              <Link
                href={`/admin/community/reports?kind=${item.key}`}
                key={item.key}
              >
                <span>
                  <AdminIcon name={item.icon} />
                  <b
                    aria-label={
                      report?.moderation[item.key] == null
                        ? "Unavailable"
                        : undefined
                    }
                    title={
                      report?.moderation[item.key] == null
                        ? "Case source unavailable"
                        : undefined
                    }
                  >
                    {report?.moderation[item.key] == null
                      ? "—"
                      : number(report.moderation[item.key])}
                  </b>
                </span>
                <small>{item.name}</small>
              </Link>
            ))}
          </div>
        </article>
        <article className="owner-reference-panel">
          <Title>Quick Actions</Title>
          <div className="owner-quick-actions">
            {[
              {
                label: "Issue Credits",
                href: "/admin/workspace/rewards?action=issue",
                icon: "credits",
              },
              {
                label: "Send Announcement",
                href: "/admin/workspace/communications?action=draft",
                icon: "send",
              },
              {
                label: "Manage Packs",
                href: "/admin/workspace/packs",
                icon: "pack",
              },
              {
                label: "View Reports",
                href: "/admin/workspace/analytics",
                icon: "chart",
              },
            ].map((item) => (
              <Link className="admin-control" key={item.label} href={item.href}>
                <AdminIcon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>
        </article>
      </section>
      <footer className="owner-reference-freshness">
        {data?.scope === "beta"
          ? "Invited beta · test-credit activity"
          : "Reporting unavailable"}{" "}
        ·{" "}
        {report
          ? `Updated ${new Date(report.generatedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} Sydney`
          : "No estimated totals"}{" "}
        · Charts share the selected period.
      </footer>
      <OwnerDetailDisclosure>
        <OwnerOperationsDetail data={data} />
        {report?.limitations.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </OwnerDetailDisclosure>
    </div>
  );
}
