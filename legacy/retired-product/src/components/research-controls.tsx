"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ResearchFactType, ResearchSource } from "@/core/research-engine";
import type { ResearchDashboard } from "@/core/research-contracts";

const value = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
const nullable = (data: FormData, name: string) => value(data, name) || null;
const list = (data: FormData, name: string) =>
  value(data, name)
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
const number = (data: FormData, name: string) => {
  const raw = value(data, name);
  if (!raw || !Number.isFinite(Number(raw)))
    throw Error("Enter the required numeric values.");
  return Number(raw);
};
const optionalNumber = (data: FormData, name: string) =>
  value(data, name) ? number(data, name) : null;
const instant = (data: FormData, name: string) => {
  const time = Date.parse(value(data, name));
  if (!Number.isFinite(time))
    throw Error("Enter the required observation and effective times.");
  return new Date(time).toISOString();
};
const optionalInstant = (data: FormData, name: string) =>
  value(data, name) ? instant(data, name) : null;

function TextInput({
  name,
  label,
  required = true,
  type = "text",
  pattern,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  pattern?: string;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} pattern={pattern} />
    </label>
  );
}
function Choice({
  name,
  label,
  options,
  initial,
}: {
  name: string;
  label: string;
  options: readonly string[];
  initial?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={initial ?? options[0]}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
function YesNo({ name, label }: { name: string; label: string }) {
  return (
    <label className="check">
      <input name={name} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
function Reason() {
  return (
    <label>
      Audit reason
      <textarea name="reason" minLength={12} maxLength={1000} required />
    </label>
  );
}
function ResearchActionForm({
  action,
  submit,
  children,
  prepare,
  disabled = false,
}: {
  action: string;
  submit: string;
  children: ReactNode;
  prepare: (data: FormData) => Record<string, unknown>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => setReady(true), []);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || disabled) return;
    setBusy(true);
    try {
      const body = { ...prepare(new FormData(event.currentTarget)), action };
      const response = await fetch("/api/admin/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMessage(
        result.error ??
          result.message ??
          (response.ok && result.ok
            ? "Audited research action recorded."
            : "Action not confirmed."),
      );
      if (response.ok && result.ok) router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error && /^(Enter|Choose)/.test(error.message)
          ? error.message
          : "Research service unavailable. No change has been confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      method="post"
      action="/api/admin/research"
      className="form-stack"
      data-research-ready={ready ? "true" : "false"}
      onSubmit={send}
    >
      {children}
      <Reason />
      <button className="button" disabled={!ready || busy || disabled}>
        {busy ? "Recording…" : submit}
      </button>
      <noscript>
        JavaScript is required to submit this structured research action.
      </noscript>
      <p role="status" className="form-message">
        {message}
      </p>
    </form>
  );
}

/** Type-specific payload construction; a text box cannot inject probability or arbitrary JSON. */
export function researchFactInput(
  data: FormData,
  type: ResearchFactType,
): Record<string, unknown> {
  if (["PLAYER_INJURY", "PLAYER_SUSPENSION", "PLAYER_RETURN"].includes(type))
    return {
      status: value(data, "availabilityStatus"),
      reason: value(data, "availabilityReason"),
    };
  if (type.includes("LINEUP"))
    return {
      playerIds: list(data, "playerIds"),
      formation: nullable(data, "formation"),
    };
  if (type === "MANAGER_CHANGE")
    return {
      previousManagerId: nullable(data, "previousManagerId"),
      newManagerId: value(data, "newManagerId"),
    };
  if (
    [
      "TEAM_FORM_UPDATE",
      "PLAYER_FORM_UPDATE",
      "TEAM_STAT_UPDATE",
      "PLAYER_STAT_UPDATE",
    ].includes(type)
  )
    return {
      metric: value(data, "metric"),
      value: value(data, "statValue"),
      unit: value(data, "unit"),
      competitionId: value(data, "competitionId"),
      season: value(data, "season"),
      venue: value(data, "venue"),
      periodStart: instant(data, "periodStart"),
      periodEnd: instant(data, "periodEnd"),
      sampleMatches: number(data, "sampleMatches"),
      sampleMinutes: optionalNumber(data, "sampleMinutes"),
      opponentAdjustment: value(data, "opponentAdjustment"),
      adjustmentVersion: nullable(data, "adjustmentVersion"),
    };
  if (type === "MATCH_RESULT")
    return {
      homeGoals: number(data, "homeGoals"),
      awayGoals: number(data, "awayGoals"),
      period: "REGULATION",
      status: "FINAL",
    };
  if (type === "REST_ADVANTAGE")
    return {
      restHours: value(data, "restHours"),
      opponentRestHours: value(data, "opponentRestHours"),
      previousEventId: value(data, "previousEventId"),
      opponentPreviousEventId: value(data, "opponentPreviousEventId"),
    };
  if (type === "SCHEDULE_CONGESTION")
    return {
      windowStart: instant(data, "windowStart"),
      windowEnd: instant(data, "windowEnd"),
      eventIds: list(data, "eventIds"),
    };
  if (type === "WEATHER_UPDATE")
    return {
      temperatureCelsius: nullable(data, "temperatureCelsius"),
      windKph: nullable(data, "windKph"),
      precipitationMm: nullable(data, "precipitationMm"),
      forecastFor: instant(data, "forecastFor"),
    };
  if (type === "VENUE_CHANGE")
    return {
      previousVenueId: nullable(data, "previousVenueId"),
      venueId: value(data, "venueId"),
    };
  if (type === "MATCH_POSTPONED")
    return {
      status: "POSTPONED",
      newStartAt: optionalInstant(data, "newStartAt"),
    };
  if (type === "MATCH_CANCELLED") return { status: "CANCELLED" };
  throw Error("Choose a supported structured fact type.");
}

function FactValueFields({ type }: { type: ResearchFactType }) {
  if (["PLAYER_INJURY", "PLAYER_SUSPENSION", "PLAYER_RETURN"].includes(type))
    return (
      <>
        <Choice
          name="availabilityStatus"
          label="Reported availability"
          options={["UNKNOWN", "OUT", "DOUBTFUL", "AVAILABLE"]}
        />
        <Choice
          name="availabilityReason"
          label="Availability reason"
          options={["UNKNOWN", "INJURY", "SUSPENSION", "RETURN", "OTHER"]}
        />
      </>
    );
  if (type.includes("LINEUP"))
    return (
      <>
        <TextInput
          name="playerIds"
          label="Canonical player IDs, comma separated"
        />
        <TextInput
          name="formation"
          label="Formation (optional, for example 4-3-3)"
          required={false}
          pattern="[0-9](-[0-9]){1,4}"
        />
        <p>
          Expected and confirmed lineups remain distinct. Confirmation requires
          all eleven players and a permitted confirmed source.
        </p>
      </>
    );
  if (type === "MANAGER_CHANGE")
    return (
      <>
        <TextInput
          name="previousManagerId"
          label="Previous manager ID (optional)"
          required={false}
        />
        <TextInput name="newManagerId" label="New manager ID" />
      </>
    );
  if (
    [
      "TEAM_FORM_UPDATE",
      "PLAYER_FORM_UPDATE",
      "TEAM_STAT_UPDATE",
      "PLAYER_STAT_UPDATE",
    ].includes(type)
  )
    return (
      <>
        <Choice
          name="metric"
          label="Sporting metric"
          options={[
            "goals",
            "goals_conceded",
            "shots",
            "shots_on_target",
            "assists",
            "minutes",
            "xg",
            "xg_conceded",
            "xg_per_90",
            "goals_per_90",
            "points",
            "wins",
            "draws",
            "losses",
            "clean_sheets",
            "possession_pct",
            "passes",
            "tackles",
            "saves",
          ]}
        />
        <TextInput name="statValue" label="Observed value" />
        <Choice
          name="unit"
          label="Unit"
          options={["count", "minutes", "per_90", "percent", "per_match"]}
        />
        <TextInput name="competitionId" label="Canonical competition ID" />
        <TextInput name="season" label="Season identifier" />
        <Choice
          name="venue"
          label="Match venue context"
          options={["ALL", "HOME", "AWAY"]}
        />
        <TextInput
          name="periodStart"
          label="Period starts (your local time)"
          type="datetime-local"
        />
        <TextInput
          name="periodEnd"
          label="Period ends (your local time)"
          type="datetime-local"
        />
        <TextInput
          name="sampleMatches"
          label="Observed match sample"
          type="number"
        />
        <TextInput
          name="sampleMinutes"
          label="Observed minutes (blank if unavailable)"
          type="number"
          required={false}
        />
        <Choice
          name="opponentAdjustment"
          label="Opponent adjustment"
          options={["UNADJUSTED", "ADJUSTED"]}
        />
        <TextInput
          name="adjustmentVersion"
          label="Adjustment version (required only for adjusted data)"
          required={false}
        />
      </>
    );
  if (type === "MATCH_RESULT")
    return (
      <>
        <TextInput
          name="homeGoals"
          label="Final home regulation goals"
          type="number"
        />
        <TextInput
          name="awayGoals"
          label="Final away regulation goals"
          type="number"
        />
        <p>
          A research fact does not settle an official Edge. Authorised results
          reconciliation remains separate.
        </p>
      </>
    );
  if (type === "REST_ADVANTAGE")
    return (
      <>
        <TextInput name="restHours" label="Observed rest hours" />
        <TextInput name="opponentRestHours" label="Opponent rest hours" />
        <TextInput name="previousEventId" label="Previous canonical event ID" />
        <TextInput
          name="opponentPreviousEventId"
          label="Opponent previous event ID"
        />
      </>
    );
  if (type === "SCHEDULE_CONGESTION")
    return (
      <>
        <TextInput
          name="windowStart"
          label="Schedule window starts (local time)"
          type="datetime-local"
        />
        <TextInput
          name="windowEnd"
          label="Schedule window ends (local time)"
          type="datetime-local"
        />
        <TextInput
          name="eventIds"
          label="Canonical event IDs, comma separated"
        />
      </>
    );
  if (type === "WEATHER_UPDATE")
    return (
      <>
        <TextInput
          name="temperatureCelsius"
          label="Temperature °C (blank if unavailable)"
          required={false}
        />
        <TextInput
          name="windKph"
          label="Wind km/h (blank if unavailable)"
          required={false}
        />
        <TextInput
          name="precipitationMm"
          label="Precipitation mm (blank if unavailable)"
          required={false}
        />
        <TextInput
          name="forecastFor"
          label="Forecast applies at (local time)"
          type="datetime-local"
        />
      </>
    );
  if (type === "VENUE_CHANGE")
    return (
      <>
        <TextInput
          name="previousVenueId"
          label="Previous venue ID (optional)"
          required={false}
        />
        <TextInput name="venueId" label="New venue ID" />
      </>
    );
  if (type === "MATCH_POSTPONED")
    return (
      <TextInput
        name="newStartAt"
        label="Rescheduled start, if confirmed (local time)"
        type="datetime-local"
        required={false}
      />
    );
  return (
    <p>
      Records a sourced cancellation assertion. It does not guess a score or
      settlement.
    </p>
  );
}

export function ManualResearchFactForm({
  eventId,
  sources,
}: {
  eventId: string;
  sources: { id: string; configuration: ResearchSource }[];
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const source = sources.find((item) => item.id === sourceId);
  const types = source?.configuration.dataTypes ?? [];
  const [chosenType, setChosenType] = useState<ResearchFactType | "">(
    types[0] ?? "",
  );
  const type = types.includes(chosenType as ResearchFactType)
    ? (chosenType as ResearchFactType)
    : types[0];
  return (
    <section className="research-panel">
      <h2>Record a structured sourced fact</h2>
      <p>
        Choose a current source approved for manual use. The server rechecks
        authority, provenance and timestamps. A member post or rumour cannot
        become model probability.
      </p>
      {!sources.length && (
        <p>
          No approved manual source is available. Source governance must be
          reviewed first.
        </p>
      )}
      <ResearchActionForm
        action="fact_record"
        submit="Record for research review"
        disabled={!source || !type}
        prepare={(data) => {
          if (!type || !source)
            throw Error("Choose an approved source and fact type.");
          return {
            sourceReviewId: source.id,
            eventId,
            type,
            teamId: nullable(data, "teamId"),
            playerId: nullable(data, "playerId"),
            value: researchFactInput(data, type),
            sourceItemId: value(data, "sourceItemId"),
            sourceRevision: value(data, "sourceRevision"),
            sourcePublishedAt: optionalInstant(data, "sourcePublishedAt"),
            sourceObservedAt: instant(data, "sourceObservedAt"),
            effectiveAt: instant(data, "effectiveAt"),
            expiresAt: instant(data, "expiresAt"),
            confidence: value(data, "confidence"),
            evidenceUrl: value(data, "evidenceUrl"),
            evidenceHash: value(data, "evidenceHash"),
            supersedesId: nullable(data, "supersedesId"),
            recordState: value(data, "recordState"),
            reason: value(data, "reason"),
          };
        }}
      >
        <label>
          Reviewed source
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            disabled={!sources.length}
          >
            <option value="">Choose a source</option>
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.configuration.name} · {item.configuration.version}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fact type
          <select
            value={type ?? ""}
            onChange={(event) =>
              setChosenType(event.target.value as ResearchFactType)
            }
            disabled={!types.length}
          >
            {!types.length && <option value="">Unavailable</option>}
            {types.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <TextInput
          name="teamId"
          label="Canonical team ID (required for team/player facts)"
          required={
            !!type &&
            (type.startsWith("TEAM_") ||
              type.startsWith("PLAYER_") ||
              type.includes("LINEUP") ||
              [
                "MANAGER_CHANGE",
                "REST_ADVANTAGE",
                "SCHEDULE_CONGESTION",
              ].includes(type))
          }
        />
        <TextInput
          name="playerId"
          label="Canonical player ID (required for player facts)"
          required={!!type?.startsWith("PLAYER_")}
        />
        {type && (
          <fieldset key={type}>
            <legend>Structured sporting observation</legend>
            <FactValueFields type={type} />
          </fieldset>
        )}
        <Choice
          name="confidence"
          label="Evidence confidence"
          options={["REPORTED", "CONFIRMED", "RUMOUR", "MODEL_DERIVED"]}
        />
        <TextInput name="sourceItemId" label="Source item identifier" />
        <TextInput name="sourceRevision" label="Source revision identifier" />
        <TextInput
          name="sourcePublishedAt"
          label="Source published at, if supplied (your local time)"
          type="datetime-local"
          required={false}
        />
        <TextInput
          name="sourceObservedAt"
          label="Source observed at (your local time)"
          type="datetime-local"
        />
        <TextInput
          name="effectiveAt"
          label="Effective from (your local time)"
          type="datetime-local"
        />
        <TextInput
          name="expiresAt"
          label="Fact expires (your local time)"
          type="datetime-local"
        />
        <TextInput
          name="evidenceUrl"
          label="Authorised source evidence URL"
          type="url"
        />
        <TextInput
          name="evidenceHash"
          label="SHA-256 of retained authorised evidence"
          pattern="[a-f0-9]{64}"
        />
        <TextInput
          name="supersedesId"
          label="Prior fact ID if correcting a record (optional)"
          required={false}
        />
        <Choice
          name="recordState"
          label="Assertion state"
          options={["ASSERTED", "WITHDRAWN"]}
        />
        <p className="form-help">
          Docked assigns the ingestion time and actor. Corrections append a new
          record; earlier evidence is retained.
        </p>
      </ResearchActionForm>
    </section>
  );
}

export function SourceGovernanceForm({
  factTypes,
}: {
  factTypes: readonly ResearchFactType[];
}) {
  return (
    <details className="research-panel">
      <summary>Register a new source review version</summary>
      <p>
        Owner/admin authority only. Official origin is not permission. Unknown
        rights remain blocked; saving a review does not enable requests.
      </p>
      <ResearchActionForm
        action="source_review"
        submit="Record source governance review"
        prepare={(data) => ({
          reason: value(data, "reason"),
          configuration: {
            schemaVersion: "research-source-v1",
            sourceId: value(data, "sourceId"),
            version: value(data, "version"),
            name: value(data, "name"),
            domain: value(data, "domain"),
            category: value(data, "category"),
            accessMethod: value(data, "accessMethod"),
            endpoint: value(data, "endpoint"),
            rightsState: value(data, "rightsState"),
            commercialUse: value(data, "commercialUse"),
            publicDisplay: value(data, "publicDisplay"),
            storage: {
              permission: value(data, "storagePermission"),
              maxDays: optionalNumber(data, "maxDays"),
              immutableEvidenceAllowed:
                data.get("immutableEvidenceAllowed") === "on",
            },
            derivedUse: value(data, "derivedUse"),
            modelUse: value(data, "modelUse"),
            automation: value(data, "automation"),
            robots: value(data, "robots"),
            etiquette: {
              minimumIntervalSeconds: optionalNumber(
                data,
                "minimumIntervalSeconds",
              ),
              maximumRequestsPerDay: optionalNumber(
                data,
                "maximumRequestsPerDay",
              ),
            },
            attribution: {
              label: value(data, "attributionLabel"),
              url: value(data, "attributionUrl"),
            },
            dataTypes: data.getAll("dataTypes"),
            reliability: value(data, "reliability"),
            jurisdictions: list(data, "jurisdictions"),
            reviewedAt: instant(data, "reviewedAt"),
            reviewDueAt: instant(data, "reviewDueAt"),
            effectiveFrom: instant(data, "effectiveFrom"),
            effectiveTo: instant(data, "effectiveTo"),
            evidenceUrls: list(data, "evidenceUrls"),
            notes: value(data, "notes"),
          },
        })}
      >
        <TextInput name="sourceId" label="Stable source ID" />
        <TextInput name="version" label="New immutable source version" />
        <TextInput name="name" label="Source name" />
        <TextInput name="domain" label="Reviewed domain" />
        <Choice
          name="category"
          label="Source category"
          options={[
            "OFFICIAL",
            "STRUCTURED_DATA",
            "NEWS",
            "WEATHER",
            "DERIVED",
          ]}
        />
        <Choice
          name="accessMethod"
          label="Access method"
          options={["MANUAL", "API", "FEED", "PAGE", "DATASET"]}
        />
        <TextInput
          name="endpoint"
          label="Reviewed HTTPS endpoint (no credentials)"
          type="url"
        />
        <Choice
          name="rightsState"
          label="Rights decision"
          options={[
            "REVIEW_REQUIRED",
            "PERMISSION_REQUIRED",
            "PROHIBITED",
            "APPROVED_MANUAL_ONLY",
            "APPROVED_AUTOMATED",
          ]}
        />
        <fieldset>
          <legend>Documented permissions</legend>
          {[
            ["commercialUse", "Commercial use"],
            ["publicDisplay", "Public/member display"],
            ["storagePermission", "Storage"],
            ["derivedUse", "Derived use"],
            ["modelUse", "Model use"],
            ["automation", "Automation"],
          ].map(([name, label]) => (
            <Choice
              key={name}
              name={name}
              label={label}
              options={["UNKNOWN", "DENIED", "ALLOWED"]}
            />
          ))}
          <TextInput
            name="maxDays"
            label="Maximum retained days (blank if unknown)"
            type="number"
            required={false}
          />
          <YesNo
            name="immutableEvidenceAllowed"
            label="Immutable evidence retention is explicitly permitted"
          />
        </fieldset>
        <Choice
          name="robots"
          label="Robots/technical permission"
          options={["UNKNOWN", "DISALLOWED", "ALLOWED", "NOT_APPLICABLE"]}
        />
        <TextInput
          name="minimumIntervalSeconds"
          label="Minimum request interval seconds (blank if unknown)"
          type="number"
          required={false}
        />
        <TextInput
          name="maximumRequestsPerDay"
          label="Maximum requests per day (blank if unknown)"
          type="number"
          required={false}
        />
        <TextInput name="attributionLabel" label="Public attribution label" />
        <TextInput
          name="attributionUrl"
          label="Public attribution HTTPS page (no credentials)"
          type="url"
        />
        <fieldset>
          <legend>Permitted fact types</legend>
          {factTypes.map((type) => (
            <label className="check" key={type}>
              <input type="checkbox" name="dataTypes" value={type} />
              <span>{type.replaceAll("_", " ")}</span>
            </label>
          ))}
        </fieldset>
        <Choice
          name="reliability"
          label="Source reliability"
          options={[
            "TIER_4_UNCONFIRMED",
            "TIER_3_RELIABLE_REPORTED",
            "TIER_2_AUTHORISED_STRUCTURED",
            "TIER_1_CONFIRMED_OFFICIAL",
          ]}
        />
        <TextInput
          name="jurisdictions"
          label="Approved jurisdiction identifiers, comma separated"
        />
        <TextInput
          name="reviewedAt"
          label="Review performed (local time)"
          type="datetime-local"
        />
        <TextInput
          name="reviewDueAt"
          label="Next review due (local time)"
          type="datetime-local"
        />
        <TextInput
          name="effectiveFrom"
          label="Rights effective from (local time)"
          type="datetime-local"
        />
        <TextInput
          name="effectiveTo"
          label="Rights end (local time)"
          type="datetime-local"
        />
        <label>
          Permission evidence HTTPS URLs, one per line
          <textarea name="evidenceUrls" required />
        </label>
        <label>
          Private review notes
          <textarea name="notes" maxLength={2000} />
        </label>
      </ResearchActionForm>
    </details>
  );
}

export function FeatureGovernanceForm({
  factTypes,
  models,
}: {
  factTypes: readonly ResearchFactType[];
  models: ResearchDashboard["models"];
}) {
  return (
    <details className="research-panel">
      <summary>Record a feature governance version</summary>
      <p>
        Display context does not change a probability. Model
        eligibility/activation requires a registered immutable model, approved
        transform, training cutoff and recorded review.
      </p>
      <ResearchActionForm
        action="feature_review"
        submit="Record feature review"
        prepare={(data) => ({
          reason: value(data, "reason"),
          configuration: {
            schemaVersion: "research-feature-v1",
            featureId: value(data, "featureId"),
            version: value(data, "version"),
            state: value(data, "state"),
            inputKind: "STRUCTURED_SPORTING_FACT",
            factTypes: data.getAll("factTypes").map(String),
            transformId: value(data, "transformId"),
            transformVersion: value(data, "transformVersion"),
            modelVersion: nullable(data, "modelVersion"),
            modelConfigHash: nullable(data, "modelConfigHash"),
            causalRationale: value(data, "causalRationale"),
            limitations: value(data, "limitations"),
            acceptedConfidence: data.getAll("acceptedConfidence").map(String),
            maxAgeSeconds: number(data, "maxAgeSeconds"),
            trainingCutoff: optionalInstant(data, "trainingCutoff"),
            reviewedAt: instant(data, "reviewedAt"),
            effectiveFrom: instant(data, "effectiveFrom"),
            effectiveTo: instant(data, "effectiveTo"),
            reviewReference: value(data, "reviewReference"),
          },
        })}
      >
        <TextInput name="featureId" label="Feature identifier" />
        <TextInput name="version" label="New feature version" />
        <Choice
          name="state"
          label="Feature state"
          options={["DISPLAY_ONLY", "MODEL_ELIGIBLE", "MODEL_ACTIVE"]}
        />
        <fieldset>
          <legend>Permitted sporting fact inputs</legend>
          {factTypes.map((type) => (
            <label className="check" key={type}>
              <input type="checkbox" name="factTypes" value={type} />
              <span>{type.replaceAll("_", " ")}</span>
            </label>
          ))}
        </fieldset>
        <TextInput name="transformId" label="Reviewed transform identifier" />
        <TextInput name="transformVersion" label="Transform version" />
        <label>
          Registered model (required beyond display only)
          <select name="modelVersion" defaultValue="">
            <option value="">No model binding</option>
            {models.map((model) => (
              <option key={model.id}>{model.id}</option>
            ))}
          </select>
        </label>
        <TextInput
          name="modelConfigHash"
          label="Immutable model configuration SHA-256 (required for model use)"
          required={false}
          pattern="[a-f0-9]{64}"
        />
        <label>
          Causal rationale
          <textarea
            name="causalRationale"
            minLength={20}
            maxLength={2000}
            required
          />
        </label>
        <label>
          Limitations
          <textarea name="limitations" maxLength={2000} required />
        </label>
        <fieldset>
          <legend>Accepted evidence confidence</legend>
          {["CONFIRMED", "REPORTED"].map((confidence) => (
            <label className="check" key={confidence}>
              <input
                type="checkbox"
                name="acceptedConfidence"
                value={confidence}
              />
              <span>{confidence}</span>
            </label>
          ))}
        </fieldset>
        <TextInput
          name="maxAgeSeconds"
          label="Maximum input age in seconds"
          type="number"
        />
        <TextInput
          name="trainingCutoff"
          label="Training cutoff (local time, required for model use)"
          type="datetime-local"
          required={false}
        />
        <TextInput
          name="reviewedAt"
          label="Reviewed at (local time)"
          type="datetime-local"
        />
        <TextInput
          name="effectiveFrom"
          label="Effective from (local time)"
          type="datetime-local"
        />
        <TextInput
          name="effectiveTo"
          label="Effective until (local time)"
          type="datetime-local"
        />
        <TextInput name="reviewReference" label="Governance review reference" />
      </ResearchActionForm>
    </details>
  );
}

export function ResearchPolicyForm({
  factTypes,
}: {
  factTypes: readonly ResearchFactType[];
}) {
  return (
    <details className="research-panel">
      <summary>Record completeness and schedule policy</summary>
      <ResearchActionForm
        action="policy_review"
        submit="Record policy version"
        prepare={(data) => ({
          reason: value(data, "reason"),
          configuration: {
            version: value(data, "version"),
            jurisdiction: value(data, "jurisdiction"),
            requiredFactTypes: data.getAll("requiredFactTypes").map(String),
            maxFactAgeSeconds: number(data, "maxFactAgeSeconds"),
            windowsSeconds: list(data, "windowsSeconds").map((raw) => {
              const parsed = Number(raw);
              if (!Number.isFinite(parsed))
                throw Error("Enter valid decision windows in seconds.");
              return parsed;
            }),
          },
        })}
      >
        <TextInput name="version" label="New policy version" />
        <TextInput
          name="jurisdiction"
          label="Approved jurisdiction identifier"
        />
        <fieldset>
          <legend>Required fact types</legend>
          {factTypes.map((type) => (
            <label className="check" key={type}>
              <input type="checkbox" name="requiredFactTypes" value={type} />
              <span>{type.replaceAll("_", " ")}</span>
            </label>
          ))}
        </fieldset>
        <TextInput
          name="maxFactAgeSeconds"
          label="Maximum fact age seconds"
          type="number"
        />
        <TextInput
          name="windowsSeconds"
          label="Configured pre-kickoff windows in seconds, comma separated"
        />
        <p>
          No cadence is selected by default. The server validates windows and
          approved scope.
        </p>
      </ResearchActionForm>
    </details>
  );
}

export function ResearchScheduleForm({ data }: { data: ResearchDashboard }) {
  return (
    <details className="research-panel">
      <summary>Configure a governed research schedule</summary>
      <p>
        A schedule is not permission to fetch. Every job rechecks source rights,
        network activation, quota, event timing and adapter availability.
      </p>
      <ResearchActionForm
        action="schedule"
        submit="Record schedule configuration"
        disabled={!data.sources.some((s) => s.current) || !data.policies.length}
        prepare={(form) => ({
          sourceReviewId: value(form, "sourceReviewId"),
          policyId: value(form, "policyId"),
          enabled: form.get("enabled") === "on",
          reason: value(form, "reason"),
        })}
      >
        <label>
          Source review
          <select name="sourceReviewId" required defaultValue="">
            <option value="">Choose reviewed source</option>
            {data.sources
              .filter((s) => s.current)
              .map((s) => (
                <option value={s.id} key={s.id}>
                  {s.configuration.name} · {s.configuration.version}
                </option>
              ))}
          </select>
        </label>
        <label>
          Frozen policy
          <select name="policyId" required defaultValue="">
            <option value="">Choose policy</option>
            {data.policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.configuration.version}
              </option>
            ))}
          </select>
        </label>
        <YesNo
          name="enabled"
          label="Enable this schedule only within separately authorised automation controls"
        />
      </ResearchActionForm>
    </details>
  );
}

export function ResearchSnapshotForm({
  eventId,
  data,
}: {
  eventId: string;
  data: ResearchDashboard;
}) {
  return (
    <details className="research-panel">
      <summary>Create an immutable as-of snapshot</summary>
      <ResearchActionForm
        action="snapshot"
        submit="Create research snapshot"
        disabled={!data.policies.length}
        prepare={(form) => ({
          eventId,
          policyId: value(form, "policyId"),
          reason: value(form, "reason"),
        })}
      >
        <label>
          Completeness policy
          <select name="policyId" required defaultValue="">
            <option value="">Choose an approved policy</option>
            {data.policies.map((p) => (
              <option value={p.id} key={p.id}>
                {p.configuration.version}
              </option>
            ))}
          </select>
        </label>
        <p>
          Docked records the snapshot time. No historical or future as-of time
          can be supplied here.
        </p>
      </ResearchActionForm>
    </details>
  );
}

export function ResearchDraftForm({
  snapshots,
}: {
  snapshots: { id: string; asOfTime: string }[];
}) {
  return (
    <details className="research-panel">
      <summary>Prepare a factual editorial draft</summary>
      <ResearchActionForm
        action="content_draft"
        submit="Create draft for editorial review"
        disabled={!snapshots.length}
        prepare={(data) => ({
          snapshotId: value(data, "snapshotId"),
          type: value(data, "type"),
          reason: value(data, "reason"),
        })}
      >
        <label>
          Retained snapshot
          <select name="snapshotId" required defaultValue="">
            <option value="">Choose a snapshot</option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.asOfTime} · {s.id}
              </option>
            ))}
          </select>
        </label>
        <Choice
          name="type"
          label="Research content type"
          options={["DOCKED_RESEARCH", "MATCH_UPDATE", "LINEUP_UPDATE"]}
        />
        <p>
          Drafts contain permitted structured facts and attribution. They remain
          private until editorial approval; creating one does not send
          notifications or publish an Edge.
        </p>
      </ResearchActionForm>
    </details>
  );
}

export function ResearchContentReviewForm({
  id,
  published,
}: {
  id: string;
  published: boolean;
}) {
  return (
    <ResearchActionForm
      action="content_review"
      submit={
        published
          ? "Withdraw published research"
          : "Publish reviewed factual research"
      }
      prepare={(data) => ({
        id,
        publish: !published,
        reason: value(data, "reason"),
      })}
    >
      <label className="check">
        <input type="checkbox" required />
        <span>
          I have reviewed the retained snapshot, source display rights,
          confidence, conflicts and attribution.
        </span>
      </label>
    </ResearchActionForm>
  );
}

export function ResearchRecalculationForm({
  snapshots,
  models,
}: {
  snapshots: { id: string; asOfTime: string }[];
  models: ResearchDashboard["models"];
}) {
  return (
    <details className="research-panel">
      <summary>Assess model recalculation eligibility</summary>
      <ResearchActionForm
        action="recalculate"
        submit="Record eligibility assessment"
        disabled={!snapshots.length || !models.length}
        prepare={(data) => ({
          snapshotId: value(data, "snapshotId"),
          modelVersion: value(data, "modelVersion"),
          reason: value(data, "reason"),
        })}
      >
        <label>
          Research snapshot
          <select name="snapshotId" required defaultValue="">
            <option value="">Choose retained snapshot</option>
            {snapshots.map((s) => (
              <option value={s.id} key={s.id}>
                {s.asOfTime} · {s.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Registered model
          <select name="modelVersion" required defaultValue="">
            <option value="">Choose model</option>
            {models.map((m) => (
              <option key={m.id}>{m.id}</option>
            ))}
          </select>
        </label>
        <p>
          This records an eligibility request, not a prediction. Inactive
          features, missing training inputs or an unavailable fitted estimator
          cannot generate probabilities.
        </p>
      </ResearchActionForm>
    </details>
  );
}

export function ResearchEnqueueForm({
  eventId,
  schedules,
}: {
  eventId: string;
  schedules: ResearchDashboard["schedules"];
}) {
  return (
    <details className="research-panel">
      <summary>Queue a governed research job</summary>
      <ResearchActionForm
        action="enqueue"
        submit="Queue reviewed event job"
        disabled={!schedules.some((s) => s.enabled)}
        prepare={(data) => ({
          eventId,
          scheduleId: value(data, "scheduleId"),
          reason: value(data, "reason"),
        })}
      >
        <label>
          Enabled schedule
          <select name="scheduleId" required defaultValue="">
            <option value="">Choose enabled schedule</option>
            {schedules
              .filter((s) => s.enabled)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
          </select>
        </label>
        <p>
          Queueing never bypasses rights or invokes an unavailable provider.
        </p>
      </ResearchActionForm>
    </details>
  );
}
