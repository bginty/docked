import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { sports, leagues } from "@/content/sports";
import { strategyV1 } from "@/core/pricing";
import { sportCoverage } from "@/core/sport-coverage";
import { publicTips, serviceStatus } from "@/server/queries";
import { identity } from "@/server/auth";
import { EdgeCard } from "@/components/edge-card";
import { SportIcon } from "@/components/sport-icon";
import { NflDirectory } from "@/components/nfl-directory";
import { SportPageHeader } from "../sport-page-header";
import "../sport-page.css";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const slug = sport === "nba" ? "basketball" : sport;
  const item = sports.find((s) => s.slug === slug);
  if (!item) return { title: "Sport not found", robots: { index: false } };
  return {
    title: `${item.title} | Sports and research`,
    description: item.description,
    alternates: { canonical: `/sports/${slug}` },
    openGraph: {
      title: `${item.title} | Docked`,
      description: item.description,
      url: `/sports/${slug}`,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${item.title} | Docked`,
      description: item.description,
      images: ["/opengraph-image"],
    },
  };
}
export default async function Sport({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  if (sport === "nba") permanentRedirect("/sports/basketball");
  const item = sports.find((s) => s.slug === sport);
  if (!item) notFound();
  const coverage = sportCoverage(item.slug, strategyV1.competitions);
  const hasConfiguredScope = coverage.competitions.length > 0;
  const [tipResult, healthResult, memberResult] = await Promise.allSettled([
    hasConfiguredScope ? publicTips() : Promise.resolve([]),
    hasConfiguredScope ? serviceStatus() : Promise.resolve(null),
    hasConfiguredScope ? identity() : Promise.resolve(null),
  ]);
  const tips =
    tipResult.status === "fulfilled"
      ? tipResult.value.filter((t) =>
          coverage.competitions.some((c) => c.id === t.competition_id),
        )
      : [];
  const active = tips.filter((t) => t.display_status === "active").slice(0, 3);
  const completed = tips
    .filter((t) => ["won", "lost", "void"].includes(t.result))
    .slice(0, 5);
  const health =
    healthResult.status === "fulfilled" ? healthResult.value : null;
  const member =
    memberResult.status === "fulfilled" ? memberResult.value : null;
  return (
    <article className="page sport-page">
      <SportPageHeader sport={item} coverage={coverage} />
      {item.slug === "nfl" && <NflDirectory />}
      <div className="sport-introduction">
        <p className="eyebrow">
          {coverage.status === "RESEARCH"
            ? "THE RESEARCH SCOPE"
            : "THE ROAD TO COVERAGE"}
        </p>
        <h2>{item.description}</h2>
        <p>{coverage.explanation}</p>
      </div>
      <div className="sport-information-layout">
        <div className="sport-rules">
          {item.sections.map(([title, text], index) => (
            <section key={title}>
              <span className="sport-section-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </section>
          ))}
        </div>
        <aside
          className="sport-scope-panel"
          aria-label={`${item.title} coverage details`}
        >
          <p className="eyebrow">COVERAGE AT A GLANCE</p>
          <SportIcon sport={item.slug} size={38} />
          <h2>{item.title}</h2>
          <dl>
            <div>
              <dt>Market scope</dt>
              <dd>{item.market}</dd>
            </div>
            <div>
              <dt>Configured competitions</dt>
              <dd>
                {coverage.competitions.length ? (
                  <ul>
                    {coverage.competitions.map((c) => (
                      <li key={c.id}>
                        {c.label}
                        <small>Research configuration</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  "None. A dedicated adapter and validation are still required."
                )}
              </dd>
            </div>
            <div>
              <dt>Live monitoring</dt>
              <dd>
                {coverage.competitions.length
                  ? health?.feed
                    ? "Provider health is available. Sport-specific market and publication checks still apply."
                    : "No healthy connected feed is established."
                  : "No active pipeline for this sport."}
              </dd>
            </div>
          </dl>
          <Link className="text-link" href="/data-status">
            Data health and availability ↗
          </Link>
        </aside>
      </div>
      <section
        className="sport-opportunities"
        aria-labelledby="sport-opportunities-heading"
      >
        <div className="sport-section-heading">
          <div>
            <p className="eyebrow">CURRENT OPPORTUNITIES</p>
            <h2 id="sport-opportunities-heading">
              Only when the criteria are met.
            </h2>
          </div>
          <Link className="text-link" href="/edges">
            View the edge board ↗
          </Link>
        </div>
        {active.length ? (
          <div className="grid three">
            {active.map((tip) => (
              <EdgeCard
                key={tip.id}
                tip={tip}
                headingLevel={3}
                timezone={member?.profile.timezone ?? "UTC"}
                format={member?.profile.odds_format ?? "decimal"}
              />
            ))}
          </div>
        ) : (
          <div className="sport-quiet-state">
            <SportIcon sport={item.slug} size={36} />
            <div>
              <h3>
                {coverage.status === "RESEARCH"
                  ? "No qualifying publications are available here."
                  : `${item.title} coverage is coming soon.`}
              </h3>
              <p>
                {coverage.status === "RESEARCH"
                  ? "Live opportunities require an approved strategy, fresh matching prices and eligibility in your region. This page does not imply a completed scan or a live feed."
                  : "There is no active pricing pipeline for this sport. Explore the market rules and research process while the foundations are assessed."}
              </p>
              <Link href="/methodology">Explore the methodology ↗</Link>
            </div>
          </div>
        )}
      </section>
      <section className="sport-recent" aria-labelledby="sport-recent-heading">
        <div className="sport-section-heading">
          <div>
            <p className="eyebrow">THE COMPLETE RECORD</p>
            <h2 id="sport-recent-heading">Recent published results.</h2>
          </div>
          <Link className="text-link" href="/results">
            View results ↗
          </Link>
        </div>
        {completed.length ? (
          <ul className="sport-result-list">
            {completed.map((tip) => (
              <li key={tip.id}>
                <div>
                  <Link href={`/tips/${tip.id}`}>
                    {tip.participants.join(" vs ")}
                  </Link>
                  <span>
                    {tip.selection} · {tip.competition_id}
                  </span>
                </div>
                <strong>{tip.result.toUpperCase()}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sport-empty-record">
            No completed {item.title.toLowerCase()} publications are available
            to display in your region. Genuine records will appear here when
            accessible. Wins, losses and voids receive the same treatment.
          </p>
        )}
      </section>
      <section
        className="sport-reading"
        aria-labelledby="sport-reading-heading"
      >
        <p className="eyebrow">READ THE GAME. UNDERSTAND THE PRICE.</p>
        <h2 id="sport-reading-heading">Continue your research.</h2>
        <div className="sport-reading-grid">
          <Link href={`/learn/${item.related}`}>
            <span>EDUCATION</span>
            <h3>{item.relatedTitle}</h3>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/methodology">
            <span>OUR METHOD</span>
            <h3>Independent sporting estimates and separate market prices.</h3>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/research">
            <span>EVIDENCE</span>
            <h3>Model research and the genuine forward record.</h3>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {leagues
          .filter((l) => l.sport === item.slug)
          .map((l) => (
            <p className="sport-league-link" key={l.slug}>
              <Link href={`/leagues/${l.slug}`}>{l.title} ↗</Link>
            </p>
          ))}
      </section>
      <p className="sport-risk-note">
        You can follow the research without betting. Estimated EV is not
        guaranteed profit.{" "}
        <Link href="/safer-gambling">Safer gambling resources</Link>.
      </p>
    </article>
  );
}
