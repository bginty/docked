import type {
  MatchResearchFile,
  PublicResearchFact,
} from "@/core/research-engine";
import { LocalTimestamp } from "./local-timestamp";

export const researchLabel = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

export function ResearchModelBoundary({
  modelObservationAvailable = false,
}: { modelObservationAvailable?: boolean }) {
  if (modelObservationAvailable)
    return (
      <aside className="research-model-blocked">
        <strong>RESEARCH MODEL OBSERVATION RETAINED</strong>
        <p>
          The independent model observation is shown separately. Missing
          editorial research does not erase that record. Predictive quality
          remains unvalidated; no official Edge is approved.
        </p>
      </aside>
    );
  return (
    <aside className="research-model-blocked">
      <strong>MODEL BLOCKED — DATA REQUIRED</strong>
      <p>
        Research context is not a prediction. Authorised model inputs and a
        fitted, approved estimator are required before a probability, Docked
        fair price or official Edge can be calculated. Market prices do not
        replace sporting evidence.
      </p>
    </aside>
  );
}

/** Display the retained structured value; never invent a summary or inference. */
export function ResearchValue({ value }: { value: Record<string, unknown> }) {
  function display(item: unknown, name: string) {
    if (item === null || item === undefined) return "Data not available";
    if (Array.isArray(item))
      return item.length ? item.map(String).join(", ") : "Not recorded";
    if (typeof item === "boolean") return item ? "Yes" : "No";
    if (typeof item === "object") return "Structured detail unavailable";
    if (
      typeof item === "string" &&
      /(?:At|Start|End|For)$/.test(name) &&
      /^\d{4}-\d{2}-\d{2}T/.test(item) &&
      Number.isFinite(Date.parse(item))
    )
      return <LocalTimestamp value={item} />;
    return String(item).replaceAll("_", " ");
  }
  return (
    <dl>
      {Object.entries(value).map(([name, item]) => (
        <div key={name}>
          <dt>{researchLabel(name)}</dt>
          <dd>{display(item, name)}</dd>
        </div>
      ))}
    </dl>
  );
}

function attributionUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function ResearchFactView({ fact }: { fact: PublicResearchFact }) {
  const url = attributionUrl(fact.sourceUrl);
  return (
    <li>
      <h3>{researchLabel(fact.type)}</h3>
      <p className="research-status">
        {fact.confidence.replaceAll("_", " ")} ·{" "}
        {fact.status.replaceAll("_", " ")} · DISPLAY CONTEXT ONLY
      </p>
      {fact.status === "CONFLICTING_EVIDENCE" && (
        <p role="note">
          Sources disagree. This assertion is not a resolved fact or a model
          input. Conflicting evidence remains in the review record.
        </p>
      )}
      {(fact.teamId || fact.playerId) && (
        <p className="research-attribution">
          {fact.teamId ? `Team mapping: ${fact.teamId}` : ""}
          {fact.playerId ? ` · Player mapping: ${fact.playerId}` : ""}
        </p>
      )}
      <ResearchValue value={fact.value} />
      <p className="research-attribution">
        Source:{" "}
        {url ? (
          <a href={url} rel="noopener noreferrer" target="_blank">
            {fact.sourceLabel}
          </a>
        ) : (
          fact.sourceLabel
        )}
        {" · "}
        {fact.confidence === "REPORTED" ? "Reported" : "Published"}{" "}
        {fact.sourcePublishedAt ? (
          <LocalTimestamp value={fact.sourcePublishedAt} />
        ) : (
          "Publication time not supplied by source"
        )}
      </p>
      <details>
        <summary>Observation times and corroboration</summary>
        <dl className="research-summary">
          <div>
            <dt>Source observed</dt>
            <dd>
              <LocalTimestamp value={fact.sourceObservedAt} />
            </dd>
          </div>
          <div>
            <dt>Recorded by Docked</dt>
            <dd>
              <LocalTimestamp value={fact.ingestedAt} />
            </dd>
          </div>
          <div>
            <dt>Effective from</dt>
            <dd>
              <LocalTimestamp value={fact.effectiveAt} />
            </dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>
              <LocalTimestamp value={fact.expiresAt} />
            </dd>
          </div>
          <div>
            <dt>Corroborating records</dt>
            <dd>{fact.corroboratingIds.length}</dd>
          </div>
          <div>
            <dt>Conflicting records</dt>
            <dd>{fact.conflictingIds.length}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

export function MatchResearchView({
  file,
  modelObservationAvailable = false,
}: {
  file: MatchResearchFile;
  modelObservationAvailable?: boolean;
}) {
  return (
    <div className="research-match">
      <section className="research-panel">
        <p className="research-content-label">
          MATCH RESEARCH FILE · NOT AN EDGE
        </p>
        <h2>
          {file.event.homeTeam} v {file.event.awayTeam}
        </h2>
        <dl className="research-summary">
          <div>
            <dt>Competition</dt>
            <dd>{file.event.competitionId}</dd>
          </div>
          <div>
            <dt>Kickoff</dt>
            <dd>
              <LocalTimestamp value={file.event.startAt} />
            </dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{file.event.venue ?? "Data not available"}</dd>
          </div>
          <div>
            <dt>Event status</dt>
            <dd>{file.event.status}</dd>
          </div>
          <div>
            <dt>Snapshot as of</dt>
            <dd>
              <LocalTimestamp value={file.asOfTime} />
            </dd>
          </div>
          <div>
            <dt>Completeness</dt>
            <dd>{file.status.replaceAll("_", " ")}</dd>
          </div>
        </dl>
        <p>
          This snapshot describes evidence available at its recorded time.
          Completeness is a required-field policy, not an invented percentage or
          a measure of predictive accuracy.
        </p>
        {file.missing.length > 0 && (
          <p>
            <strong>Required data missing:</strong>{" "}
            {file.missing.map(researchLabel).join(", ")}.
          </p>
        )}
      </section>
      <ResearchModelBoundary
        modelObservationAvailable={modelObservationAvailable}
      />
      <section className="research-panel">
        <h2>Market comparison remains separate</h2>
        <p>
          A market observation is not a sporting-model probability. Research
          completeness does not activate a feature, generate a prediction or
          qualify a selection for the official record.
        </p>
      </section>
      <div className="research-grid">
        {file.sections.map((section) => (
          <section className="research-panel" key={section.key}>
            <h2>{researchLabel(section.key)}</h2>
            {section.facts.length ? (
              <ul className="research-facts">
                {section.facts.map((fact) => (
                  <ResearchFactView key={fact.id} fact={fact} />
                ))}
              </ul>
            ) : (
              <p className="research-empty">
                DATA NOT AVAILABLE. No value is inferred.
              </p>
            )}
          </section>
        ))}
      </div>
      <section className="research-panel">
        <h2>Evidence timeline</h2>
        <p>
          Ordered by when Docked received each retained fact. Later observations
          cannot support an earlier snapshot.
        </p>
        <ol className="research-timeline">
          {[
            ...new Map(
              file.sections
                .flatMap((section) => section.facts)
                .map((fact) => [fact.id, fact]),
            ).values(),
          ]
            .sort(
              (a, b) =>
                Date.parse(a.ingestedAt) - Date.parse(b.ingestedAt) ||
                a.id.localeCompare(b.id),
            )
            .map((fact) => (
              <li key={fact.id}>
                <LocalTimestamp value={fact.ingestedAt} /> ·{" "}
                {researchLabel(fact.type)} · {fact.sourceLabel} ·{" "}
                {fact.confidence}
              </li>
            ))}
        </ol>
        {!file.factIds.length && (
          <p>No eligible fact observations are retained in this snapshot.</p>
        )}
      </section>
      <section className="research-panel">
        <h2>Snapshot provenance</h2>
        <p>
          Policy <code>{file.policyVersion}</code>
        </p>
        <p>
          Snapshot hash <code>{file.snapshotHash}</code>
        </p>
        <p>
          Later changes require another snapshot; this record is not silently
          rewritten.
        </p>
      </section>
    </div>
  );
}
