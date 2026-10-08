import Link from "next/link";
import {
  fantasyPlatformEnabled as fantasyEnabled,
  fantasyProductionEnabled,
} from "@/core/fantasy-production";
import { FantasyHero, FantasyLogo } from "@/components/fantasy-brand";
import { readingRoom } from "@/server/cms";
import { environmentPresentation } from "@/server/presentation";
import { EdgeCard } from "@/components/edge-card";
import { NoEdge } from "@/components/no-edge";
import {
  serviceStatus,
  regionAccess,
  publicTips,
  monitoringContext,
} from "@/server/queries";
import { identity } from "@/server/auth";
import {
  activeHomepageTips,
  publicBoardState,
} from "@/core/public-presentation";
import { SportImage } from "@/components/sport-image";
import { ArticleImage } from "@/components/article-image";
import { ExploreSports } from "@/components/explore-sports";
import { SportIcon } from "@/components/sport-icon";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };
export default async function Home() {
  const production = fantasyProductionEnabled();
  const liveBeta = production && process.env.DOCKED_RELEASE_CHANNEL === "beta";
  if (fantasyEnabled())
    return (
      <div className="fantasy-public">
        <header>
          <Link href="/" aria-label="Docked home">
            <FantasyLogo />
          </Link>
          <Link className="button" href="/app/login">
            {production ? "Log in" : "Tester login"}
          </Link>
        </header>
        <section className="fantasy-welcome">
          <FantasyHero />
          <div>
            <p className="eyebrow">
              {liveBeta
                ? "FANTASY CARDS · LIVE BETA"
                : production
                  ? "FANTASY CARDS · FREE TO PLAY"
                  : "FANTASY CARDS PREVIEW V1"}
            </p>
            <h1>
              COLLECT.
              <br />
              BUILD.
              <br />
              COMPETE.
            </h1>
            <p>
              {production
                ? "Collect limited fictional player cards. Open your free Starter pack, build your football team and earn daily gameplay rewards."
                : "Collect limited fictional player cards. Build your football team. Compete, buy, sell and trade using test credits."}
            </p>
            <p>One collection, on your phone and in your browser.</p>
            <div className="actions">
              <Link className="button" href="/fantasy/play">
                Open member workspace
              </Link>
              <Link
                href={production && !liveBeta ? "/app/signup" : "/app/login"}
              >
                {production && !liveBeta
                  ? "Create a free account"
                  : "Invited tester access"}
              </Link>
            </div>
            <p className="small-note">
              {production
                ? "Free gameplay. Fictional players. No paid packs, cash value or cash prizes. Marketplace transfers are not open yet."
                : "Closed Preview for 2–3 testers. Fictional players, test credits and Preview/Test Prizes only."}
            </p>
          </div>
        </section>
        <section className="fantasy-stats">
          <div>
            <h2>Collect</h2>
            <p>
              Every card has a permanent identity, serial and ownership history.
            </p>
          </div>
          <div>
            <h2>Build</h2>
            <p>
              Field a legal eleven with your free Starter pack. Rarity never
              multiplies fantasy points.
            </p>
          </div>
          <div>
            <h2>Compete</h2>
            <p>
              {production
                ? "Enter free leagues and track simulated rounds. Rarity never multiplies fantasy scores."
                : "Enter leagues and track simulated rounds. Trade with fellow testers."}
            </p>
          </div>
        </section>
        <footer>
          <p>DOCKED · COLLECT. BUILD. COMPETE.</p>
          <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </div>
    );
  const [status, region, tips, monitoring, viewer, articles, environment] =
    await Promise.all([
      serviceStatus(),
      regionAccess(),
      publicTips(),
      monitoringContext(),
      identity(),
      readingRoom(),
      environmentPresentation(),
    ]);
  const state = publicBoardState(
    { ...status, region: region.allowed },
    !!viewer,
  );
  const active = activeHomepageTips(tips);
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
          <p className="eyebrow">SPORTS INTELLIGENCE · COMMUNITY</p>
          <h1>
            BUILT FOR
            <br />
            AN EDGE
          </h1>
          <p className="hero-description">
            Sports intelligence, transparent research and a community built
            around evidence.
          </p>
          <p className="hero-proof">
            <span>Every published tip tracked.</span>
            <span>No guaranteed returns.</span>
          </p>
          <div className="actions">
            <Link className="button" href="/join">
              {environment.production && !environment.registrationAvailable
                ? "Account access"
                : "Join free"}{" "}
              <span aria-hidden="true">↗</span>
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
      <ExploreSports />
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
              "Estimate, then compare",
              "Develop an independent sporting model from authorised data. Compare its uncertain probability estimate with a separately observed market price.",
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
              "Model research",
              "Sporting data informs a versioned probability model. Historical tips are never reconstructed.",
              "Research only",
            ],
            [
              "02",
              "Forward paper",
              "Decisions recorded prospectively, before outcomes.",
              "Not started",
            ],
            [
              "03",
              "Docked Record",
              "The official record begins with the first genuine forward-published Edge.",
              "Forward publications only",
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
          {environment.production && !environment.registrationAvailable
            ? "Check account availability"
            : "Join free"}{" "}
          ↗
        </Link>
      </section>
    </>
  );
}
