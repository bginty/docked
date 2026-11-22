import Link from "next/link";
import {
  rosterRegistration,
  type OwnerRosterQuery,
  type OwnerRosterReport,
  type OwnerRosterRow,
} from "@/core/commercial-player-roster";
import { OwnerRosterDownload } from "./owner-roster-download";
import styles from "./owner-rosters.module.css";

const label = (value: string) =>
  value === "LEGACY"
    ? "Unreviewed legacy"
    : value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^./, (c) => c.toUpperCase());
function queryString(filters: OwnerRosterQuery, page = filters.page) {
  return new URLSearchParams(
    Object.entries({ ...filters, page }).map(([key, value]) => [
      key,
      String(value),
    ]),
  ).toString();
}
function when(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Date(value).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function evidenceLink(value: string | null) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
function RosterRow({ row }: { row: OwnerRosterRow }) {
  const legacy = row.verification === "LEGACY";
  const evidence = evidenceLink(row.evidenceUrl);
  return (
    <tr>
      <th scope="row">
        {row.name}
        <small className={styles.muted}>{row.playerId}</small>
        {row.aliases.length > 0 && (
          <details>
            <summary>Provider IDs</summary>
            {row.aliases.map((alias) => (
              <small key={`${alias.provider}:${alias.providerId}`}>
                {alias.provider}: {alias.providerId}
              </small>
            ))}
          </details>
        )}
      </th>
      <td>{row.sport.toUpperCase()}</td>
      <td>
        {legacy
          ? "Current club unverified"
          : (row.currentClubName ?? "Unattached")}
        {!legacy && row.currentClubId && (
          <small className={styles.muted}>{row.currentClubId}</small>
        )}
      </td>
      <td>
        {row.savedClubs.length
          ? row.savedClubs.join(", ")
          : "No card definitions"}
        {legacy && row.savedClubs.length > 0 && (
          <small className={styles.muted}>
            Audit grouping for an unreviewed roster
          </small>
        )}
      </td>
      <td>
        <span className={styles.status}>{label(row.registration)}</span>
        <small className={styles.muted}>
          {row.availability === "UNKNOWN"
            ? "Availability unknown"
            : label(row.availability)}
        </small>
      </td>
      <td>
        <span className={styles.status}>
          {row.eligibility ? "Eligible" : "Excluded"}
          {legacy ? " · legacy rule" : ""}
        </span>
        <small className={styles.muted}>{row.eligibilityReason}</small>
      </td>
      <td>
        {legacy ? (
          <span>Current roster not reviewed</span>
        ) : (
          <>
            <span>Reviewed</span>
            <time dateTime={row.reviewedAt ?? undefined}>
              {when(row.reviewedAt)}
            </time>
            <small className={styles.muted}>
              Observed {when(row.observedAt)}
            </small>
            <small className={styles.muted}>
              Effective {when(row.effectiveAt)}
            </small>
          </>
        )}
        {evidence ? (
          <a href={evidence} target="_blank" rel="noreferrer noopener">
            {legacy ? "Saved source evidence" : "Roster source"}
          </a>
        ) : (
          <small className={styles.muted}>No source link recorded</small>
        )}
      </td>
      <td>{row.existingCards.toLocaleString("en-AU")}</td>
      <td>
        {row.definitionCount === 0 ? (
          <span>Not configured</span>
        ) : (
          <details>
            <summary>
              {row.definitionCount.toLocaleString("en-AU")} definitions
            </summary>
            <small>
              {row.approvedDefinitions.toLocaleString("en-AU")} approved
            </small>
            <small>
              {row.lifetimeIssued.toLocaleString("en-AU")} issued across
              lifetime
            </small>
            {row.supply.map((definition) => (
              <Link
                key={definition.id}
                href={`/admin/workspace/cards?record=${encodeURIComponent(definition.id)}`}
              >
                {label(definition.rarity)} ·{" "}
                {definition.issued.toLocaleString("en-AU")}/
                {definition.cap.toLocaleString("en-AU")}
              </Link>
            ))}
          </details>
        )}
      </td>
    </tr>
  );
}

export function OwnerRosters({
  report,
  ownerId,
}: {
  report: OwnerRosterReport;
  ownerId: string;
}) {
  const filters = report.filters;
  const query = queryString(filters);
  const selectedClubPresent =
    !filters.club ||
    report.clubs.some((club) => `${club.sport}:${club.id}` === filters.club);
  const first = report.total ? (report.page - 1) * report.pageSize + 1 : 0;
  const last = report.rows.length ? first + report.rows.length - 1 : 0;
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">DOCKED OPERATIONS</p>
          <h1>Player roster</h1>
          <p>
            Review current clubs, player registrations and eligibility for new
            packs.
          </p>
        </div>
        <Link href="/admin/operations">Commercial operations</Link>
      </header>
      <section className={styles.panel} aria-label="Roster filters">
        <form method="get" action="/admin/rosters" className={styles.filters}>
          <label>
            Sport
            <select name="sport" defaultValue={filters.sport}>
              <option value="all">All live sports</option>
              {(["nfl", "afl", "nrl"] as const).map((sport) => (
                <option key={sport} value={sport}>
                  {sport.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Club for audit
            <select name="club" defaultValue={filters.club}>
              <option value="">All clubs</option>
              {!selectedClubPresent && (
                <option value={filters.club}>
                  Selected club · {filters.club}
                </option>
              )}
              {report.clubs.map((club) => (
                <option
                  key={`${club.sport}:${club.id}`}
                  value={`${club.sport}:${club.id}`}
                >
                  {club.sport.toUpperCase()} · {club.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Player name or ID
            <input name="q" defaultValue={filters.q} maxLength={120} />
          </label>
          <label>
            Registration
            <select name="status" defaultValue={filters.status}>
              <option value="ALL">All registrations</option>
              <option value="LEGACY">Unreviewed legacy</option>
              {rosterRegistration.options.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Roster / supply eligibility
            <select name="issuance" defaultValue={filters.issuance}>
              <option value="ALL">All eligibility</option>
              <option value="ELIGIBLE">Eligible</option>
              <option value="EXCLUDED">Excluded</option>
            </select>
          </label>
          <label>
            Roster review
            <select name="verification" defaultValue={filters.verification}>
              <option value="ALL">All review states</option>
              <option value="VERIFIED">Reviewed roster</option>
              <option value="LEGACY">Needs roster review</option>
            </select>
          </label>
          <div className="actions">
            <button className="button" type="submit">
              Apply filters
            </button>
            <Link href="/admin/rosters">Reset</Link>
          </div>
        </form>
      </section>
      <section className={styles.panel} aria-labelledby="roster-list-heading">
        <div className={styles.toolbar}>
          <div>
            <h2 id="roster-list-heading">
              {report.total.toLocaleString("en-AU")} matching players
            </h2>
            <p className={styles.muted}>
              Generated {when(report.generatedAt)} Sydney
            </p>
          </div>
          <OwnerRosterDownload query={query} ownerId={ownerId} />
        </div>
        <p>
          The CSV includes every player matching these filters across all pages,
          sorted by sport, club and player name. Reviewed players use their
          current club; unreviewed players are grouped by their saved card club.
        </p>
        <p className={styles.muted}>
          Eligibility here covers the roster and available card supply.
          Purchases and awards also require the usual account, approval and
          sales checks.
        </p>
        {report.summary.legacy > 0 && (
          <p className={styles.warning}>
            Legacy players have no reviewed current roster record. Their saved
            card club does not verify a current registration. Eligibility shows
            the roster and supply rule currently in use.
          </p>
        )}
        <p className={styles.muted}>
          Current club and saved card club are separate records. Existing cards
          keep their identity and ownership history. Roster registration alone
          does not remove a card from its owner or change trading permissions.
        </p>
        {report.rows.length ? (
          <div
            className={styles.tableWrap}
            tabIndex={0}
            role="region"
            aria-label="Player roster table; scroll horizontally for all columns"
          >
            <table className={styles.table}>
              <caption>One row per player · evidence times in Sydney</caption>
              <thead>
                <tr>
                  {[
                    "Player",
                    "Sport",
                    "Current club",
                    "Saved card club",
                    "Registration",
                    "Roster / supply eligibility",
                    "Roster evidence",
                    "Existing copies",
                    "Card definitions",
                  ].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <RosterRow key={`${row.sport}:${row.playerId}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No players appear on this page. Reset the filters or return to the
            previous page.
          </p>
        )}
        <nav className={styles.toolbar} aria-label="Roster pages">
          <p>
            {report.rows.length
              ? `${first.toLocaleString("en-AU")}–${last.toLocaleString("en-AU")} of ${report.total.toLocaleString("en-AU")}`
              : "0 players shown"}{" "}
            · Page {report.page.toLocaleString("en-AU")}
          </p>
          <div className="actions">
            {report.page > 1 && (
              <Link
                className="button ghost"
                href={`/admin/rosters?${queryString(filters, report.page - 1)}`}
              >
                Previous page
              </Link>
            )}
            {report.hasMore && (
              <Link
                className="button ghost"
                href={`/admin/rosters?${queryString(filters, report.page + 1)}`}
              >
                Next page
              </Link>
            )}
          </div>
        </nav>
      </section>
    </div>
  );
}
