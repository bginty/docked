import Link from "next/link";
import { articles } from "@/content/articles";
import { EdgeCard } from "@/components/edge-card";
import { NoEdge } from "@/components/no-edge";
import {
  serviceStatus,
  regionAccess,
  publicTips,
  monitoringContext,
} from "@/server/queries";
import { identity } from "@/server/auth";
import { boardState } from "@/core/policy";
import { SportImage } from "@/components/sport-image";
import { ArticleImage } from "@/components/article-image";
import { ExploreSports } from "@/components/explore-sports";
import { SportIcon } from "@/components/sport-icon";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };
export default async function Home() {
  const [status, region, tips, monitoring, viewer] = await Promise.all([
    serviceStatus(),
    regionAccess(),
    publicTips(),
    monitoringContext(),
    identity(),
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
      <section className="cinematic-hero">
        <SportImage
          sport="football"
          variant="hero"
          className="hero-photo"
          sizes="100vw"
          preload
        />
        <div className="cinematic-hero-inner">
          <p className="eyebrow">DOCKED / SPORT. PRICE. EDGE.</p>
          <h1>
            Only when
            <br />
            the price offers <em>value.</em>
          </h1>
          <p className="hero-description">
            Free sports analysis and alerts when our method estimates a market
            edge.
          </p>
          <p className="hero-proof">
            <span>Every published tip tracked.</span>
            <span>No guaranteed returns.</span>
          </p>
          <div className="actions">
            <Link className="button" href="/join">
              Join free <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button ghost" href="/results">
              View results
            </Link>
          </div>
          <p className="small-note">
            Free for the first 12 months from launch. No card required.
          </p>
        </div>
        <p className="hero-photo-caption">
          The game sets the stage. Evidence sets the standard.
        </p>
      </section>
      <ExploreSports />
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
              <EdgeCard
                headingLevel={3}
                key={t.id}
                tip={t}
                timezone={viewer?.profile.timezone}
                format={viewer?.profile.odds_format}
              />
            ))}
          </div>
        ) : (
          <NoEdge
            state={state}
            monitoring={monitoring}
            timezone={viewer?.profile.timezone}
            latest={articles[0]}
            completed={tips.filter((t) =>
              ["won", "lost", "void"].includes(t.result),
            )}
          />
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
              className="article-card sport-article-card"
              href={`/learn/${a.slug}`}
              key={a.slug}
            >
              <ArticleImage
                slug={a.slug}
                sizes="(max-width: 650px) 90vw, 30vw"
              />
              <div className="article-card-copy">
                <span className="eyebrow">
                  {a.category} / {a.minutes} MIN READ
                </span>
                <h3>{a.title}</h3>
                <p>{a.summary}</p>
                <span className="article-arrow" aria-hidden="true">
                  ↗
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="sports-identity-strip" aria-hidden="true">
          <span>
            <SportIcon sport="football" /> Sport in perspective
          </span>
          <span>
            <SportIcon sport="basketball" /> Every price has a context
          </span>
          <span>
            <SportIcon sport="tennis" /> Every record matters
          </span>
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
