import Link from "next/link";
import { sports } from "@/content/sports";
import { strategyV1 } from "@/core/pricing";
import { sportCoverage } from "@/core/sport-coverage";
import { SportImage } from "@/components/sport-image";
import { SportIcon } from "@/components/sport-icon";
import "./sport-page.css";
export const metadata = {
  title: "Explore sports",
  description:
    "Explore Docked’s global sporting world, from football and NBA research to planned tennis, cricket, racing and more. Clear rules. Honest coverage.",
  alternates: { canonical: "/sports" },
  openGraph: {
    title: "Explore sports | Docked",
    description:
      "The sport comes first. Know exactly what Docked’s research covers.",
    url: "/sports",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore sports | Docked",
    images: ["/opengraph-image"],
  },
};
export default function Sports() {
  const researchCount = sports.filter(
    (s) => sportCoverage(s.slug, strategyV1.competitions).status === "RESEARCH",
  ).length;
  return (
    <div className="page sport-page">
      <header className="sport-page-hero sport-directory-hero">
        <SportImage
          sport="football"
          variant="header"
          className="sport-page-photo"
          preload
          sizes="100vw"
          decorative
        />
        <div className="sport-page-hero-content">
          <p className="eyebrow">THE WORLD OF SPORT</p>
          <h1>
            Sport first.
            <br />
            Everywhere.
          </h1>
          <p>
            From the floodlights to the finish line. Explore the games, the
            market rules and the evidence behind our approach.
          </p>
          <a className="sport-hero-link" href="#sports-directory">
            Explore {sports.length} sports <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="sport-directory-caption">
          {researchCount} sports in the installed research scope · Live
          activation requires separate approval
        </div>
      </header>
      <section
        id="sports-directory"
        className="sport-directory"
        aria-labelledby="sport-directory-heading"
      >
        <div className="sport-section-heading">
          <div>
            <p className="eyebrow">EXPLORE SPORTS</p>
            <h2 id="sport-directory-heading">Find your game.</h2>
          </div>
          <p>
            Research means a market definition is implemented. Coming soon means
            planned coverage, with no active pricing pipeline or launch date.
          </p>
        </div>
        <div className="sport-directory-grid">
          {sports.map((sport, i) => {
            const coverage = sportCoverage(sport.slug, strategyV1.competitions);
            return (
              <Link
                key={sport.slug}
                className={`sport-directory-card ${i === 0 ? "sport-directory-featured" : ""}`}
                href={`/sports/${sport.slug}`}
              >
                <SportImage
                  sport={sport.slug}
                  variant="tile"
                  sizes={
                    i === 0
                      ? "(max-width: 640px) 100vw, (max-width: 960px) 100vw, 66vw"
                      : "(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw"
                  }
                  decorative
                />
                <div className="sport-directory-card-content">
                  <span
                    className={`sport-coverage-badge ${coverage.status === "RESEARCH" ? "is-research" : ""}`}
                  >
                    {coverage.label}
                  </span>
                  <div className="sport-directory-title">
                    <SportIcon sport={sport.slug} size={28} />
                    <h3>{sport.title}</h3>
                    <span aria-hidden="true">↗</span>
                  </div>
                  <p>{sport.kicker}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <aside className="sport-evidence-note">
        <SportIcon sport="football" size={32} />
        <div>
          <h2>The same standard. Every sport.</h2>
          <p>
            Pictures show our sporting world, not a list of live feeds. New
            coverage needs licensed data, matched settlement rules and
            independently reviewed evidence. Estimated EV is never guaranteed
            profit.
          </p>
        </div>
        <Link className="text-link" href="/methodology">
          Read the methodology ↗
        </Link>
      </aside>
    </div>
  );
}
