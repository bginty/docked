import { notFound } from "next/navigation";
import Link from "next/link";
import { articles, safetyNote } from "@/content/articles";
import { PageHeading, Notice } from "@/components/ui";
import { publishedArticle } from "@/server/cms";
import { articleStructuredData, safeJsonLd } from "@/content/editorial";
import { ShareLink } from "@/components/share-link";
import { ArticleImage } from "@/components/article-image";
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
    ...(!a?.published ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      title: a?.title,
      description: a?.summary,
      url: `/learn/${slug}`,
      publishedTime: a?.publishedAt ?? undefined,
      modifiedTime: a?.updatedAt ?? undefined,
      authors: ["Docked editorial"],
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: a?.title,
      description: a?.summary,
      images: ["/opengraph-image"],
    },
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
    <article className="page prose sports-editorial">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            articleStructuredData(
              a,
              process.env.SITE_URL ?? "http://localhost:3000",
            ),
          ),
        }}
      />
      <Link className="text-link" href="/learn">
        ← Reading room
      </Link>
      <PageHeading
        eyebrow={`${a.category.toUpperCase()} / ${a.minutes} MIN READ`}
        title={a.title}
      >
        {a.summary}
      </PageHeading>
      <ArticleImage
        slug={a.slug}
        className="article-feature-lead"
        sizes="(max-width: 760px) 90vw, 820px"
        preload
      />
      <p className="article-meta">
        {a.author} ·{" "}
        {a.published
          ? "Published editorial"
          : "Educational draft · Fictional examples"}
        {a.publishedAt ? (
          <>
            {" "}
            · Published{" "}
            <time dateTime={a.publishedAt}>
              {new Date(a.publishedAt).toLocaleDateString("en-AU", {
                timeZone: "Australia/Melbourne",
              })}
            </time>
          </>
        ) : a.createdAt ? (
          <>
            {" "}
            · Prepared <time dateTime={a.createdAt}>{a.createdAt}</time>
          </>
        ) : null}
        {a.updatedAt && (
          <>
            {" "}
            · Updated{" "}
            <time dateTime={a.updatedAt}>{a.updatedAt.slice(0, 10)}</time>
          </>
        )}
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
      <section aria-label="Editorial corrections">
        <ShareLink />
        <h2>Corrections and review</h2>
        {a.corrections.length ? (
          a.corrections.map((c) => (
            <p key={c.at}>
              <time dateTime={c.at}>{c.at.slice(0, 10)}</time> · {c.reason}
            </p>
          ))
        ) : (
          <p>
            No published corrections.{" "}
            {a.published
              ? "Substantive revisions will be dated and explained here."
              : "This educational draft still requires editorial approval before release."}
          </p>
        )}
        <Link href="/contact">Report a factual issue</Link>
      </section>
      <section>
        <h2>Read next</h2>
        <ul>
          {articles
            .filter((other) => other.slug !== slug)
            .filter(
              (other) =>
                other.category === a.category ||
                ["minimum-odds", "estimated-ev-and-returns"].includes(
                  other.slug,
                ),
            )
            .slice(0, 3)
            .map((other) => (
              <li key={other.slug}>
                <Link href={`/learn/${other.slug}`}>{other.title}</Link>
              </li>
            ))}
        </ul>
      </section>
      <Link className="text-link" href="/methodology">
        See the full methodology ↗
      </Link>
    </article>
  );
}
