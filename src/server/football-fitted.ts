import "server-only";
import {
  fitPoisson,
  predictPoisson,
  validatePoissonTraining,
  type PoissonFit,
} from "@/core/football-poisson";
import { phase5Hash } from "@/core/phase5-hash";
import type { ReferenceSql } from "./market-reference";
import researchPolicy from "../../config/football-v1-research-policy.json";

/** Trusted server path only. SQL independently requires current administrator MFA.
 * No HTTP handler accepts coefficients, probabilities or training data from members. */
export async function registerFittedFootballModel(
  tx: ReferenceSql,
  input: {
    modelVersion: string;
    codeCommit: string;
    actorId: string;
    training: unknown;
    manifest: Record<string, unknown>;
    sourceIds: string[];
  },
) {
  const training = validatePoissonTraining(input.training);
  const dataCutoff = training.matches.reduce(
    (latest, m) =>
      Date.parse(m.observedAt) > Date.parse(latest) ? m.observedAt : latest,
    training.matches[0].observedAt,
  );
  const fit = fitPoisson(training),
    fittedHash = phase5Hash(fit);
  const configuration = {
    modelId: "football-goals",
    modelVersion: input.modelVersion,
    sport: "football",
    market: "regulation_1x2",
    proposedMethod: "independent-poisson-goals",
    validationStatus: "UNVALIDATED",
    parameters: fit.parameters,
    fittedHash,
    trainingDataHash: fit.trainingHash,
    estimator: fit.config,
    advantageClaim: false,
  };
  const configHash = phase5Hash(configuration);
  await tx`insert into private.football_model_versions(id,method,configuration,config_hash,code_commit,created_by)
    values(${input.modelVersion},'independent-football-model',${tx.json(configuration)},${configHash},${input.codeCommit},${input.actorId})`;
  await tx`select private.transition_football_model(${input.modelVersion},'RESEARCH','Initial dated sporting-data research fit; no live approval','{}')`;
  const [manifest] =
    await tx`insert into private.football_training_manifests(model_version,training,training_hash,manifest,manifest_hash,fitted,fitted_hash,source_ids,code_commit,input_cutoff,fitted_at,actor)
    values(${input.modelVersion},${tx.json(training)},${fit.trainingHash},${tx.json(JSON.parse(JSON.stringify(input.manifest)))},${phase5Hash(input.manifest)},${tx.json(fit)},${fittedHash},${input.sourceIds},${input.codeCommit},${dataCutoff},clock_timestamp(),${input.actorId}) returning id`;
  await tx`insert into private.football_model_implementations(model_version,implementation_id,code_commit,config_hash,training_data_hash,reviewed_by,evidence)
    values(${input.modelVersion},'regularised-independent-poisson-v1',${input.codeCommit},${configHash},${fit.trainingHash},${input.actorId},'Deterministic fitted research baseline; retained training manifest; prospective calibration required')`;
  await tx`select private.transition_football_model(${input.modelVersion},'FORWARD_CALIBRATION','Begin prospective probability observation only; publication remains disabled',${tx.json({ manifestId: manifest.id, fittedHash, validationStatus: "UNVALIDATED" })})`;
  return { manifestId: String(manifest.id), configHash, fittedHash, fit };
}

/** Compute from retained data; never take a caller's probability or market value. */
export async function fittedFootballPrediction(
  tx: ReferenceSql,
  eventId: string,
  modelVersion: string,
  codeCommit: string,
) {
  const [row] =
    await tx`select t.fitted,t.fitted_hash,t.training_hash,t.code_commit,t.input_cutoff::text input_cutoff,i.id input_id,i.input_hash,i.payload,i.created_at input_created,
    v.config_hash,v.lifecycle,e.start_at,e.status event_status
    from private.football_training_manifests t join private.football_model_versions v on v.id=t.model_version
    join private.football_sporting_inputs i on i.payload->>'manifestId'=t.id::text
    join private.events e on e.id=i.event_id
    where t.model_version=${modelVersion} and i.event_id=${eventId} and i.payload->>'schemaVersion'='football-fitted-input-v1'
    order by i.created_at desc limit 1 for share of t,v,i,e`;
  if (!row) return null;
  if (
    row.code_commit !== codeCommit ||
    row.fitted_hash !== phase5Hash(row.fitted) ||
    row.fitted.trainingHash !== row.training_hash ||
    row.event_status !== "scheduled" ||
    ![
      "RESEARCH",
      "FORWARD_CALIBRATION",
      "APPROVED_FOR_CANDIDATES",
      "APPROVED_FOR_LIVE",
    ].includes(row.lifecycle)
  )
    throw Error("Fitted model binding unavailable");
  const [clock] = await tx`select clock_timestamp() observed`;
  const asOfTime = new Date(clock.observed).toISOString();
  if (
    Date.parse(asOfTime) - Date.parse(row.input_cutoff) >
    researchPolicy.maximumSportingSnapshotAgeSeconds * 1000
  )
    return {
      row,
      asOfTime,
      result: {
        status: "ABSTAIN" as const,
        reason: "STALE_SPORTING_SNAPSHOT",
        probabilities: null,
      },
    };
  if (new Date(row.input_created).getTime() >= Date.parse(asOfTime))
    throw Error("Retained input must precede calculation");
  const result = predictPoisson(row.fitted as PoissonFit, {
    home: row.payload.event.homeTeamId,
    away: row.payload.event.awayTeamId,
    competitionId: "soccer_epl",
    asOfTime,
    startAt: new Date(row.start_at).toISOString(),
  });
  return { row, result, asOfTime };
}
