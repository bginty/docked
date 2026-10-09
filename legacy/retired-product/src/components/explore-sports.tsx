import Link from "next/link";
import { sports } from "@/content/sports";
import { sportCoverage } from "@/core/sport-coverage";
import { strategyV1 } from "@/core/pricing";
import { SportImage } from "./sport-image";
import { SportIcon } from "./sport-icon";
export function ExploreSports() {
  return (
    <section
      className="section sports-explore"
      aria-labelledby="explore-sports-title"
    >
      <div className="section-title">
        <div>
          <p className="eyebrow">A WORLD OF SPORT</p>
          <h2 id="explore-sports-title">Explore sports.</h2>
          <p className="sports-intro">
            Different games. The same respect for the evidence. Explore our
            research scope and the sports on our roadmap.
          </p>
        </div>
        <Link className="text-link" href="/sports">
          All sports & coverage ↗
        </Link>
      </div>
      <div className="sports-grid">
        {sports.map((s) => {
          const coverage = sportCoverage(s.slug, strategyV1.competitions);
          return (
            <Link
              href={`/sports/${s.slug}`}
              className="sport-tile"
              key={s.slug}
            >
              <SportImage
                sport={s.slug}
                sizes="(max-width: 760px) 46vw, (max-width: 1440px) 30vw, 420px"
              />
              <div className="sport-tile-inner">
                <div className="sport-tile-top">
                  <SportIcon sport={s.slug} size={27} />
                  <span className="sport-tile-arrow" aria-hidden="true">
                    ↗
                  </span>
                </div>
                <h3>{s.title}</h3>
                <span
                  className={`coverage-tag ${coverage.status === "RESEARCH" ? "research" : ""}`}
                >
                  {coverage.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="sports-grid-note">
        Research coverage describes the configured, unvalidated strategy.
        Planned sports have no active edge analysis. Photography does not
        indicate live coverage.
      </p>
    </section>
  );
}
