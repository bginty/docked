import Link from "next/link";
import { notFound } from "next/navigation";
import { leagues, sports } from "@/content/sports";
import { strategyV1 } from "@/core/pricing";
import { sportCoverage } from "@/core/sport-coverage";
import { SportPageHeader } from "../../sports/sport-page-header";
import "../../sports/sport-page.css";
export function generateStaticParams() {
  return leagues.map((l) => ({ league: l.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  const item = leagues.find((l) => l.slug === league);
  if (!item) return { title: "League not found", robots: { index: false } };
  return {
    title: item.title,
    description: item.description,
    alternates: { canonical: `/leagues/${league}` },
    openGraph: {
      title: item.title,
      description: item.description,
      url: `/leagues/${league}`,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description: item.description,
      images: ["/opengraph-image"],
    },
  };
}
export default async function League({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  const item = leagues.find((l) => l.slug === league);
  const sport = sports.find((s) => s.slug === item?.sport);
  if (!item || !sport) notFound();
  const coverage = sportCoverage(sport.slug, strategyV1.competitions);
  return (
    <article className="page sport-page">
      <SportPageHeader sport={sport} coverage={coverage} title="NBA research" />
      <div className="sport-introduction">
        <p className="eyebrow">THE COMPETITION / THE CONTRACT</p>
        <h2>One competition. A precisely defined market.</h2>
        <p>
          {item.description} {coverage.explanation}
        </p>
      </div>
      <div className="sport-information-layout">
        <div className="sport-rules">
          <section>
            <span className="sport-section-number" aria-hidden="true">
              01
            </span>
            <div>
              <h2>Event identity is part of the evidence.</h2>
              <p>
                A usable NBA record needs an approved competition identifier,
                canonical participants, a provider event identifier and a
                commencement instant. Source names must be mapped explicitly. A
                team name alone cannot resolve two fixtures with changed
                schedules or inconsistent start times. Any correction needs an
                audit trail rather than a silent replacement.
              </p>
            </div>
          </section>
          <section>
            <span className="sport-section-number" aria-hidden="true">
              02
            </span>
            <div>
              <h2>One market contract per comparison.</h2>
              <p>
                The installed research scope is an overtime-inclusive,
                two-outcome moneyline. Complete price vectors from at least two
                independently operated references are required, excluding the
                offered bookmaker and related trading skins. A regulation-only
                contract cannot enter this comparison. Spreads, totals, player
                markets and alternative periods remain outside the scope.
              </p>
            </div>
          </section>
          <section>
            <span className="sport-section-number" aria-hidden="true">
              03
            </span>
            <div>
              <h2>Evidence before activation.</h2>
              <p>
                Independent sporting-model inputs, current market comparisons
                and outcome data each require appropriate rights and review.
                Coverage, missingness, mapping and regional eligibility remain
                explicit checks. Historical sporting statistics may support
                model research; historical Docked tips and betting ROI are not
                reconstructed as a launch requirement. Model research, forward
                paper and genuine published records remain separate. A positive
                estimated EV is not proof of profitable execution.
              </p>
            </div>
          </section>
        </div>
        <aside className="sport-scope-panel">
          <p className="eyebrow">NBA / RESEARCH SCOPE</p>
          <h2>Keep the boundaries visible.</h2>
          <p>{sport.market}.</p>
          <p>
            No fixture list or historical record is invented for this page.
            Active opportunities and accessible completed records belong on the
            basketball coverage page.
          </p>
          <Link className="text-link" href="/sports/basketball">
            Explore basketball ↗
          </Link>
          <hr />
          <Link className="text-link" href="/data-status">
            Check data status ↗
          </Link>
        </aside>
      </div>
      <aside className="sport-evidence-note">
        <div>
          <h2>Three records. Three different claims.</h2>
          <p>
            A retrospective test, forward-paper selection and live publication
            answer different questions. Docked keeps their records separate.
          </p>
        </div>
        <Link className="text-link" href="/learn/backtest-paper-live">
          Read the evidence guide ↗
        </Link>
      </aside>
    </article>
  );
}
