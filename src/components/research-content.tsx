import Link from "next/link";
import type {
  ReviewedResearch,
  ReviewedResearchItem,
} from "@/core/research-contracts";
import { LocalTimestamp } from "./local-timestamp";
import { ResearchFactView } from "./research-file";

export function ReviewedResearchCard({
  item,
  expanded = false,
  headingLevel = 3,
}: {
  item: ReviewedResearchItem;
  expanded?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const facts = [
    ...new Map(
      item.file.sections.flatMap((s) => s.facts).map((f) => [f.id, f]),
    ).values(),
  ];
  return (
    <article className="research-content-card">
      <p className="research-content-label">
        {item.type.replaceAll("_", " ")} · NOT AN EDGE
      </p>
      <Heading>
        {expanded ? (
          item.headline
        ) : (
          <Link href={`/research/matches/${item.id}`}>{item.headline}</Link>
        )}
      </Heading>
      <p>
        {item.file.event.homeTeam} v {item.file.event.awayTeam} ·{" "}
        <LocalTimestamp value={item.file.event.startAt} />
      </p>
      <p className="research-attribution">
        Updated <LocalTimestamp value={item.updatedAt} /> · Evidence as of{" "}
        <LocalTimestamp value={item.file.asOfTime} />
      </p>
      <p>
        Reviewed sporting context, not a probability or betting recommendation.
        Reported facts can change.
      </p>
      {expanded ? (
        <ul className="research-facts">
          {facts.map((fact) => (
            <ResearchFactView key={fact.id} fact={fact} />
          ))}
        </ul>
      ) : (
        <Link
          className="research-inline-link"
          href={`/research/matches/${item.id}`}
        >
          Read facts, sources and missing data
        </Link>
      )}
    </article>
  );
}

export function ReviewedResearchList({
  data,
  compact = false,
}: {
  data: ReviewedResearch;
  compact?: boolean;
}) {
  return (
    <section className="research-public" aria-label="Reviewed match research">
      <h2>Docked research</h2>
      {data.items.length ? (
        <div className="research-content-list">
          {data.items.map((item) => (
            <ReviewedResearchCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className={compact ? "edge-quiet-state" : "research-panel"}>
          <strong>
            {data.status === "READY"
              ? "No reviewed match updates yet."
              : "Reviewed research is not available in this view."}
          </strong>
          <p>
            Source permissions and editorial review are required. No sporting
            facts or predictions are invented to fill this space.
          </p>
        </div>
      )}
    </section>
  );
}
