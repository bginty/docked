import Link from "next/link";
import { notFound } from "next/navigation";
import { leagues } from "@/content/sports";
import { PageHeading, Notice } from "@/components/ui";
export function generateStaticParams() {
  return leagues.map((l) => ({ league: l.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  const l = leagues.find((l) => l.slug === league);
  return {
    title: l?.title,
    description: l?.description,
    alternates: { canonical: `/leagues/${league}` },
    openGraph: {
      title: l?.title,
      description: l?.description,
      url: `/leagues/${league}`,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: l?.title,
      description: l?.description,
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
  const l = leagues.find((l) => l.slug === league);
  if (!l) notFound();
  return (
    <article className="page prose">
      <Link href={`/sports/${l.sport}`}>← Sport market rules</Link>
      <PageHeading eyebrow="LEAGUE / RESEARCH ONLY" title={l.title}>
        {l.description}
      </PageHeading>
      <Notice>
        Data integration and validation pending. No fixture list or historical
        record is invented for this page.
      </Notice>
      <h2>Event identity is part of the evidence</h2>
      <p>
        A usable NBA event record must carry an approved competition identifier,
        canonical participant identifiers, provider event identifier and UTC
        commencement time. Home/away order and source names must be mapped
        explicitly. A team name alone cannot resolve two fixtures with changed
        schedules or inconsistent start times.
      </p>
      <h2>One market contract per comparison</h2>
      <p>
        The proposed scope is an overtime-inclusive, two-outcome moneyline. Full
        price vectors from at least two independently operated references are
        required, excluding the offered bookmaker and related trading skins.
        Matching prices from a regulation-only market to this contract would
        invalidate the comparison.
      </p>
      <h2>Before league coverage can launch</h2>
      <p>
        Docked needs licensed current and historical odds, an authorised outcome
        source, coverage and missingness reports, approved source mappings and
        evidence for each region. Historical development, validation, held-out
        research and forward paper tracking remain separate. A favourable
        estimated EV by itself satisfies none of these release requirements.
      </p>
      <div className="inline-links">
        <Link href="/data-status">Data status</Link>
        <Link href="/research">Validation plan</Link>
        <Link href="/learn/backtest-paper-live">Evidence categories</Link>
      </div>
    </article>
  );
}
