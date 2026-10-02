import Link from "next/link";
import { notFound } from "next/navigation";
import { sports, leagues } from "@/content/sports";
import { PageHeading, Notice } from "@/components/ui";
export function generateStaticParams() {
  return sports.map((s) => ({ sport: s.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const s = sports.find((s) => s.slug === sport);
  return {
    title: s?.title,
    description: s?.description,
    alternates: { canonical: `/sports/${sport}` },
    openGraph: {
      title: s?.title,
      description: s?.description,
      url: `/sports/${sport}`,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: s?.title,
      description: s?.description,
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
  const s = sports.find((s) => s.slug === sport);
  if (!s) notFound();
  return (
    <article className="page prose">
      <Link href="/sports">← Sports and research scope</Link>
      <PageHeading eyebrow={`SPORTS / ${s.status}`} title={s.title}>
        {s.description}
      </PageHeading>
      <Notice>{s.market}. No approved live tips are implied.</Notice>
      {s.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <h2>Continue your research</h2>
      <ul>
        <li>
          <Link href={`/learn/${s.related}`}>
            Read the related pricing guide
          </Link>
        </li>
        <li>
          <Link href="/methodology">Complete strategy methodology</Link>
        </li>
        <li>
          <Link href="/results">Live publication ledger</Link>
        </li>
        {leagues
          .filter((l) => l.sport === s.slug)
          .map((l) => (
            <li key={l.slug}>
              <Link href={`/leagues/${l.slug}`}>{l.title}</Link>
            </li>
          ))}
      </ul>
    </article>
  );
}
