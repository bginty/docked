import Link from "next/link";
import type { SportContent } from "@/content/sports";
import type { sportCoverage } from "@/core/sport-coverage";
import { SportImage } from "@/components/sport-image";
import { SportIcon } from "@/components/sport-icon";
export function SportPageHeader({
  sport,
  coverage,
  title = sport.title,
}: {
  sport: SportContent;
  coverage: ReturnType<typeof sportCoverage>;
  title?: string;
}) {
  return (
    <header className="sport-page-hero">
      <SportImage
        sport={sport.slug}
        variant="header"
        className="sport-page-photo"
        sizes="100vw"
        preload
        decorative
      />
      <div className="sport-page-hero-content">
        <Link className="sport-breadcrumb" href="/sports">
          ← Explore sports
        </Link>
        <div className="sport-hero-category">
          <SportIcon sport={sport.slug} size={30} />
          <span className="eyebrow">
            SPORT / {coverage.label.toUpperCase()}
          </span>
        </div>
        <h1>{title}</h1>
        <p className="sport-kicker">{sport.kicker}</p>
        <span
          className={`sport-coverage-badge ${coverage.status === "RESEARCH" ? "is-research" : ""}`}
        >
          {coverage.label}
        </span>
      </div>
      <div className="sport-page-image-caption">
        Sporting atmosphere · No specific event or live opportunity is
        represented
      </div>
    </header>
  );
}
