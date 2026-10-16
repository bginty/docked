import Link from "next/link";
import type { AdminRecord } from "@/core/admin-record";
import { searchDestination } from "@/core/admin-navigation";
import styles from "./admin-record-detail.module.css";

export function AdminRecordDetail({ record }: { record: AdminRecord }) {
  const href = searchDestination(record.category, record.id);
  return (
    <section className={styles.panel} aria-labelledby="record-title">
      <p className={styles.eyebrow}>Authoritative record · Read only</p>
      <h2 id="record-title">{record.title}</h2>
      <p className="muted">{record.source}</p>
      <dl className={styles.fields}>
        {Object.entries(record.fields).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value === null
                ? "Unavailable"
                : typeof value === "boolean"
                  ? value
                    ? "Yes"
                    : "No"
                  : String(value)}
            </dd>
          </div>
        ))}
      </dl>
      <h3>Recorded history</h3>
      <p className="muted">
        Timestamps are UTC. These records do not grant permission to change
        assets or balances.
      </p>
      {!record.history.length ? (
        <p>No recorded events on this page.</p>
      ) : (
        <ol className={styles.history}>
          {record.history.map((event) => (
            <li key={event.id}>
              <strong>{event.event}</strong>
              <span>{event.detail}</span>
              <small>
                {event.at ? (
                  <time dateTime={event.at}>{event.at}</time>
                ) : (
                  "Timestamp unavailable"
                )}
              </small>
            </li>
          ))}
        </ol>
      )}
      <nav className="actions" aria-label="Record history pages">
        {record.page > 1 && (
          <Link
            className="button ghost"
            href={`${href}&historyPage=${record.page - 1}`}
          >
            Previous events
          </Link>
        )}
        {record.hasMore && (
          <Link
            className="button ghost"
            href={`${href}&historyPage=${record.page + 1}`}
          >
            Next events
          </Link>
        )}
      </nav>
      {record.category === "moderation" && (
        <Link className="button ghost" href="/admin/community/reports">
          Open moderation investigations
        </Link>
      )}
    </section>
  );
}
