import Link from "next/link";
import { articles } from "@/content/articles";
import { Empty } from "@/components/ui";
import { serviceStatus, regionAccess, publicTips } from "@/server/queries";
import { boardState } from "@/core/policy";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [status, region, tips] = await Promise.all([
    serviceStatus(),
    regionAccess(),
    publicTips(),
  ]);
  const state = status.strategy
    ? boardState({ ...status, region: region.allowed })
    : boardState({ ...status, region: true });
  const active = tips.filter(
    (t) =>
      t.availability === "active" &&
      new Date(t.start_at).getTime() > Date.now() + 600000,
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> SPORTS PRICING, WITH PERSPECTIVE
          </p>
          <h1>
            Only when
            <br />
            the price
            <br />
            offers <em>value.</em>
          </h1>
          <p className="hero-description">
            See opportunities when our method estimates a market edge. Every
            published tip tracked. No guaranteed returns.
          </p>
          <div className="actions">
            <Link className="button" href="/join">
              Join free <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button ghost" href="/results">
              View our record
            </Link>
          </div>
          <p className="small-note">
            Free for the first 12 months from launch. No card required.
          </p>
        </div>
        <div className="hero-panel">
          <div className="panel-top">
            <span>THE DOCKED APPROACH</span>
            <span className="tiny-label">RESEARCH V1</span>
          </div>
          <div className="price-art" aria-hidden="true">
            <div className="art-grid" />
            <svg viewBox="0 0 500 250">
              <path d="M0 172 C60 168 75 145 130 151 S210 102 265 126 S335 83 390 94 S455 56 500 42" />
              <path
                className="reference-line"
                d="M0 185 C65 164 94 187 140 161 S245 160 290 140 S367 133 413 117 S475 128 500 102"
              />
              <circle cx="390" cy="94" r="6" />
            </svg>
            <div className="art-label">PRICE ≠ PROBABILITY</div>
          </div>
          <h2>
            A price is a question.
            <br />
            The evidence comes first.
          </h2>
          <p>
            Independent references. Fixed decision rules. A complete record,
            including the losses.
          </p>
          <div className="panel-bottom">
            <span>Concept illustration · no performance data</span>
            <Link href="/methodology" aria-label="Read the methodology">
              ↗
            </Link>
          </div>
        </div>
      </section>
      <div className="service-strip">
        <span>
          <i className="status-dot amber" />{" "}
          {status.strategy
            ? "Strategy reviewed"
            : "Research validation pending"}
        </span>
        <span>
          {status.feed
            ? "Latest shared snapshot fresh"
            : "Feeds unavailable / not activated"}
        </span>
        <span>
          {status.publication ? "Publication enabled" : "Publication paused"}
        </span>
        <Link href="/data-status">Service status ↗</Link>
      </div>
      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">THE OPPORTUNITY BOARD</p>
            <h2>Patience is part of the process.</h2>
          </div>
          <Link className="text-link" href="/edges">
            Explore the board ↗
          </Link>
        </div>
        {active.length ? (
          <div className="grid three">
            {active.slice(0, 3).map((t) => (
              <Link key={t.id} href={`/tips/${t.id}`} className="card">
                <span className="pill">Live published</span>
                <h3>{t.selection}</h3>
                <p>
                  Publication odds {t.odds} · minimum {t.minimum_odds}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title={state.title}>{state.detail}</Empty>
        )}
        <p className="muted small-note">
          A pending or unavailable feed does not imply that a live scan found no
          opportunities.
        </p>
      </section>
      <section className="section process-section">
        <div>
          <p className="eyebrow">A METHOD YOU CAN QUESTION</p>
          <h2>
            Less noise.
            <br />
            More accountability.
          </h2>
          <Link className="text-link" href="/methodology">
            Read our methodology ↗
          </Link>
        </div>
        <div className="process-list">
          {[
            [
              "01",
              "Compare like with like",
              "Match the event, market and settlement rules. Remove margin from complete, independent reference markets.",
            ],
            [
              "02",
              "Let the rules decide",
              "Reject stale quotes and unsupported markets. Publish only at fixed decision windows when every check passes.",
            ],
            [
              "03",
              "Keep the whole record",
              "Archive every publication. Separate estimated EV from realised returns, and show corrections openly.",
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <article>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">KNOW WHAT YOU ARE LOOKING AT</p>
            <h2>Three records. Never blended.</h2>
          </div>
          <Link href="/research" className="text-link">
            Evidence standards ↗
          </Link>
        </div>
        <div className="grid three">
          {[
            [
              "01",
              "Historical research",
              "A replay of past data under frozen rules.",
              "Validation pending",
            ],
            [
              "02",
              "Forward paper",
              "Decisions recorded prospectively, before outcomes.",
              "Not started",
            ],
            [
              "03",
              "Live published",
              "Actual public tips, timestamped before the event.",
              "Not launched",
            ],
          ].map(([n, t, d, s]) => (
            <article className="card" key={n}>
              <span className="card-number">{n} / EVIDENCE</span>
              <h3>{t}</h3>
              <p>{d}</p>
              <span className="pill">{s}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">THE READING ROOM</p>
            <h2>Understand the price.</h2>
          </div>
          <Link className="text-link" href="/learn">
            All guides ↗
          </Link>
        </div>
        <div className="grid three">
          {articles.slice(0, 3).map((a) => (
            <Link
              className="article-card"
              href={`/learn/${a.slug}`}
              key={a.slug}
            >
              <span className="eyebrow">
                {a.category} / {a.minutes} MIN READ
              </span>
              <h3>{a.title}</h3>
              <p>{a.summary}</p>
              <span className="article-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="join-band">
        <div>
          <p className="eyebrow">USEFUL, EVEN WHEN YOU DON’T BET</p>
          <h2>
            Follow the evidence.
            <br />
            At your own pace.
          </h2>
          <p>
            Personalise your reading, save tips and choose your alerts when
            registration opens.
          </p>
        </div>
        <Link className="button light" href="/join">
          Join free ↗
        </Link>
      </section>
    </>
  );
}
