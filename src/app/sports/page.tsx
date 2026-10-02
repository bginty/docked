import Link from "next/link";
import { sports } from "@/content/sports";
import { PageHeading, Notice } from "@/components/ui";
export const metadata = {
  title: "Sports and research coverage",
  description:
    "Docked’s focused research scope: football 1X2, NBA moneyline and the reasons NFL markets remain unsupported.",
  alternates: { canonical: "/sports" },
  openGraph: {
    title: "Sports and research coverage",
    url: "/sports",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sports and research coverage",
    images: ["/opengraph-image"],
  },
};
export default function Sports() {
  return (
    <div className="page">
      <PageHeading eyebrow="SCOPE / SPORTS" title="Know what the rules cover.">
        Market definitions come before price comparisons. These pages describe
        research scope; they do not imply that a feed, strategy or jurisdiction
        is approved.
      </PageHeading>
      <div className="grid three">
        {sports.map((s) => (
          <article className="card" key={s.slug}>
            <span className="pill">{s.status}</span>
            <h2>{s.title}</h2>
            <p>{s.description}</p>
            <Link className="text-link" href={`/sports/${s.slug}`}>
              Read the market rules ↗
            </Link>
          </article>
        ))}
      </div>
      <Notice>
        No live coverage is established by these educational pages. Check{" "}
        <Link href="/data-status">data status</Link> and{" "}
        <Link href="/research">research progress</Link> for the release gates.
      </Notice>
    </div>
  );
}
