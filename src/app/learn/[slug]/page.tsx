import { notFound } from "next/navigation";
import Link from "next/link";
import { articles, safetyNote } from "@/content/articles";
import { PageHeading, Notice } from "@/components/ui";
import { publishedArticle } from "@/server/cms";
export const dynamic = "force-dynamic";
export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await publishedArticle(slug);
  return {
    title: a?.title,
    description: a?.summary,
    alternates: { canonical: `/learn/${slug}` },
  };
}
export default async function Article({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await publishedArticle(slug);
  if (!a) notFound();
  return (
    <article className="page prose">
      <Link className="text-link" href="/learn">
        ← Reading room
      </Link>
      <PageHeading
        eyebrow={`${a.category.toUpperCase()} / ${a.minutes} MIN READ`}
        title={a.title}
      >
        {a.summary}
      </PageHeading>
      <p className="article-meta">
        Docked editorial ·{" "}
        {a.published
          ? "Published editorial"
          : "2 October 2026 · Educational draft · Fictional examples"}
      </p>
      {a.sections.map(([h, p]) => (
        <section key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </section>
      ))}
      <Notice>
        {safetyNote}{" "}
        <Link href="/safer-gambling">Support and pause options</Link>.
      </Notice>
      <Link className="text-link" href="/methodology">
        See the full methodology ↗
      </Link>
    </article>
  );
}
