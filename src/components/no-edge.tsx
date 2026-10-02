import Link from "next/link";
import { SportImage } from "./sport-image";
import { SportIcon } from "./sport-icon";
import { localEventTime } from "@/core/tip-presentation";
export type MonitoringContext = {
  available: boolean;
  markets: { label: string; status: string }[];
  events: { id: string; label: string; startAt: string }[];
};
export function NoEdge({
  state,
  monitoring,
  completed = [],
  timezone = "Australia/Melbourne",
  latest,
}: {
  state: { code: string; title: string; detail: string };
  monitoring: MonitoringContext;
  completed?: { id: string; selection: string; result: string }[];
  timezone?: string;
  latest: { slug: string; title: string; summary: string };
}) {
  return (
    <div className="no-edge-panel">
      <div className="no-edge-visual">
        <SportImage
          sport="football"
          variant="atmosphere"
          className="no-edge-photo"
          sizes="(max-width: 1280px) 90vw, 1150px"
        />
        <div className="no-edge-message">
          <span className="no-edge-emblem">
            <SportIcon sport="football" size={26} />
          </span>
          <h2>
            {state.code === "no_edge"
              ? "No qualifying edge right now."
              : state.title}
          </h2>
          <p>
            {state.code === "no_edge"
              ? "Docked publishes only when the configured threshold and every eligibility check are met. There is no daily tip quota."
              : state.detail}
          </p>
          <Link className="text-link" href="/data-status">
            See data status <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <div className="grid two no-edge-resources">
        <section className="card">
          <h3>Markets being monitored</h3>
          {monitoring.available && monitoring.markets.length ? (
            <ul className="plain-list">
              {monitoring.markets.map((m) => (
                <li key={m.label}>
                  {m.label}
                  <small>{m.status}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No verified monitoring coverage is available to display. A missing
              feed is not a completed scan.
            </p>
          )}
          <Link className="text-link" href="/sports">
            Explore research coverage ↗
          </Link>
          <h3>Next monitored events</h3>
          {monitoring.available && monitoring.events.length ? (
            <ul className="plain-list">
              {monitoring.events.slice(0, 3).map((e) => (
                <li key={e.id}>
                  {e.label}
                  <small>
                    {localEventTime(e.startAt, timezone)} · {timezone}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Upcoming events will appear when authorised, fresh event data and
              regional access are available.
            </p>
          )}
        </section>
        <section className="card">
          <h3>Recent completed results</h3>
          {completed.length ? (
            <ul className="plain-list">
              {completed.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <Link href={`/tips/${t.id}`}>{t.selection}</Link>
                  <small>{t.result}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No completed live publications are available in this view.
              Historical research and fictional examples do not fill this
              record.
            </p>
          )}
          <div className="inline-links">
            <Link href="/results">Complete record</Link>
            <Link href="/results#weekly-performance">Weekly performance</Link>
            <Link href="/methodology">Methodology</Link>
          </div>
          <p className="eyebrow">LATEST READING</p>
          <h3>
            <Link href={`/learn/${latest.slug}`}>{latest.title}</Link>
          </h3>
          <p>{latest.summary}</p>
        </section>
      </div>
    </div>
  );
}
