import { z } from "zod";
import Decimal from "decimal.js";
import { phase5Hash } from "./phase5-hash";
import { validateFootballProbabilities } from "./football-model";

const instant = z.iso.datetime({ offset: true });
const team = z.string().min(1).max(160);
const trainingRow = z
  .object({
    id: z.string().min(1),
    home: team,
    away: team,
    date: z.iso.date(),
    homeGoals: z.number().int().min(0).max(100),
    awayGoals: z.number().int().min(0).max(100),
    observedAt: instant,
    sourceId: z.string().min(1),
  })
  .strict();
export const poissonTrainingSchema = z
  .object({
    schemaVersion: z.literal("epl-poisson-training-v1"),
    competitionId: z.literal("soccer_epl"),
    asOfTime: instant,
    matches: z.array(trainingRow).min(20).max(100000),
  })
  .strict();
export const poissonConfigSchema = z
  .object({
    method: z.literal("regularised-independent-poisson-v1"),
    halfLifeDays: z.number().min(30).max(3650),
    ridge: z.number().min(0.01).max(100),
    minimumTeamMatches: z.number().int().min(8).max(100),
    maximumIterations: z.number().int().min(20).max(500),
    gradientTolerance: z.number().min(1e-10).max(1e-5),
  })
  .strict();
export const initialPoissonConfig = Object.freeze({
  method: "regularised-independent-poisson-v1" as const,
  halfLifeDays: 365,
  ridge: 1,
  minimumTeamMatches: 8,
  maximumIterations: 100,
  gradientTolerance: 1e-8,
});
type Training = z.infer<typeof poissonTrainingSchema>;
export function validatePoissonTraining(input: unknown): Training {
  const v = poissonTrainingSchema.parse(input),
    ids = new Set<string>();
  for (const m of v.matches) {
    if (ids.has(m.id) || m.home === m.away)
      throw Error("Duplicate or invalid sporting identity");
    ids.add(m.id);
    // A date-only source cannot establish same-day finality. Retain the observation clock honestly.
    if (
      m.date >= m.observedAt.slice(0, 10) ||
      Date.parse(m.observedAt) > Date.parse(v.asOfTime)
    )
      throw Error("Training evidence unavailable at cutoff");
  }
  return {
    ...v,
    matches: [...v.matches].sort((a, b) => a.id.localeCompare(b.id, "en")),
  };
}
export function recencyWeight(
  date: string,
  asOfTime: string,
  halfLifeDays: number,
) {
  z.iso.date().parse(date);
  instant.parse(asOfTime);
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0)
    throw Error("Invalid half life");
  const days =
    (Date.parse(asOfTime.slice(0, 10)) - Date.parse(date)) / 86400000;
  if (days < 0) throw Error("Future match");
  return Math.exp((-Math.LN2 * days) / halfLifeDays);
}
type Observation = { indices: number[]; goals: number; weight: number };
function evaluate(parameters: number[], rows: Observation[], ridge: number) {
  const n = parameters.length,
    gradient = Array<number>(n).fill(0),
    hessian = Array.from({ length: n }, () => Array<number>(n).fill(0));
  let objective = 0;
  for (const r of rows) {
    const eta = r.indices.reduce((sum, i) => sum + parameters[i], 0),
      lambda = Math.exp(eta);
    objective += r.weight * (lambda - r.goals * eta);
    for (const i of r.indices) {
      gradient[i] += r.weight * (lambda - r.goals);
      for (const j of r.indices) hessian[i][j] += r.weight * lambda;
    }
  }
  for (let i = 2; i < n; i++) {
    objective += (ridge * parameters[i] ** 2) / 2;
    gradient[i] += ridge * parameters[i];
    hessian[i][i] += ridge;
  }
  return { objective, gradient, hessian };
}
/** Cholesky solve for the positive-definite penalised likelihood Hessian. */
function solve(a: number[][], b: number[]) {
  const n = b.length,
    l = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let sum = a[i][j];
      for (let k = 0; k < j; k++) sum -= l[i][k] * l[j][k];
      if (i === j) {
        if (!(sum > 0) || !Number.isFinite(sum))
          throw Error("MODEL_FIT_SINGULAR");
        l[i][j] = Math.sqrt(sum);
      } else l[i][j] = sum / l[j][j];
    }
  const y = Array<number>(n).fill(0),
    x = Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= l[i][k] * y[k];
    y[i] = sum / l[i][i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let k = i + 1; k < n; k++) sum -= l[k][i] * x[k];
    x[i] = sum / l[i][i];
  }
  return x;
}
export function fitPoisson(
  input: unknown,
  configuration: unknown = initialPoissonConfig,
) {
  const training = validatePoissonTraining(input),
    config = poissonConfigSchema.parse(configuration);
  const teams = [
    ...new Set(training.matches.flatMap((m) => [m.home, m.away])),
  ].sort();
  const counts = Object.fromEntries(teams.map((t) => [t, 0])),
    rows: Observation[] = [];
  for (const m of training.matches) {
    counts[m.home]++;
    counts[m.away]++;
    const h = teams.indexOf(m.home),
      a = teams.indexOf(m.away),
      weight = recencyWeight(m.date, training.asOfTime, config.halfLifeDays);
    rows.push({
      indices: [0, 1, 2 + h, 2 + teams.length + a],
      goals: m.homeGoals,
      weight,
    });
    rows.push({
      indices: [0, 2 + a, 2 + teams.length + h],
      goals: m.awayGoals,
      weight,
    });
  }
  const mean =
    rows.reduce((s, r) => s + r.weight * r.goals, 0) /
    rows.reduce((s, r) => s + r.weight, 0);
  if (!(mean > 0)) throw Error("INSUFFICIENT_SCORING_DATA");
  let parameters = Array<number>(2 + 2 * teams.length).fill(0);
  parameters[0] = Math.log(mean);
  let iteration = 0,
    state = evaluate(parameters, rows, config.ridge);
  for (; iteration < config.maximumIterations; iteration++) {
    if (Math.max(...state.gradient.map(Math.abs)) <= config.gradientTolerance)
      break;
    const step = solve(state.hessian, state.gradient);
    const slope = state.gradient.reduce((s, g, i) => s + g * step[i], 0);
    let scale = 1,
      accepted = false;
    for (let trial = 0; trial < 40; trial++, scale /= 2) {
      const next = parameters.map((p, i) => p - scale * step[i]),
        candidate = evaluate(next, rows, config.ridge);
      if (
        Number.isFinite(candidate.objective) &&
        candidate.objective <= state.objective - 1e-4 * scale * slope + 1e-12
      ) {
        parameters = next;
        state = candidate;
        accepted = true;
        break;
      }
    }
    if (!accepted) throw Error("MODEL_FIT_LINE_SEARCH_FAILED");
  }
  const gradientMax = Math.max(...state.gradient.map(Math.abs));
  if (gradientMax > config.gradientTolerance)
    throw Error("MODEL_FIT_NOT_CONVERGED");
  return {
    schemaVersion: "epl-poisson-fit-v1" as const,
    competitionId: "soccer_epl" as const,
    trainingHash: phase5Hash(training),
    config,
    configHash: phase5Hash(config),
    asOfTime: training.asOfTime,
    teams,
    counts,
    parameters,
    diagnostics: {
      iterations: iteration,
      gradientMax,
      objective: state.objective,
      matches: training.matches.length,
      converged: true as const,
      validationStatus: "UNVALIDATED" as const,
    },
  };
}
export type PoissonFit = ReturnType<typeof fitPoisson>;
/** No network, market references, prose or client-supplied probability is accepted. */
export function predictPoisson(fit: PoissonFit, input: unknown) {
  const event = z
    .object({
      home: team,
      away: team,
      competitionId: z.literal("soccer_epl"),
      asOfTime: instant,
      startAt: instant,
    })
    .strict()
    .parse(input);
  if (
    event.home === event.away ||
    Date.parse(event.asOfTime) < Date.parse(fit.asOfTime) ||
    Date.parse(event.startAt) <= Date.parse(event.asOfTime)
  )
    throw Error("Invalid prospective prediction cutoff");
  if (
    !fit.diagnostics.converged ||
    fit.configHash !== phase5Hash(fit.config) ||
    fit.parameters.length !== 2 + 2 * fit.teams.length ||
    fit.parameters.some((p) => !Number.isFinite(p))
  )
    throw Error("Invalid fitted state");
  const h = fit.teams.indexOf(event.home),
    a = fit.teams.indexOf(event.away);
  if (
    h < 0 ||
    a < 0 ||
    fit.counts[event.home] < fit.config.minimumTeamMatches ||
    fit.counts[event.away] < fit.config.minimumTeamMatches
  )
    return {
      status: "ABSTAIN" as const,
      reason: "INSUFFICIENT_TEAM_SAMPLE",
      probabilities: null,
    };
  const p = fit.parameters,
    homeGoals = Math.exp(p[0] + p[1] + p[2 + h] + p[2 + fit.teams.length + a]),
    awayGoals = Math.exp(p[0] + p[2 + a] + p[2 + fit.teams.length + h]);
  if (
    ![homeGoals, awayGoals].every((v) => Number.isFinite(v) && v > 0 && v <= 20)
  )
    return {
      status: "ABSTAIN" as const,
      reason: "EXPECTED_GOALS_OUTSIDE_RESEARCH_SUPPORT",
      probabilities: null,
    };
  function mass(lambda: number) {
    const values = [Math.exp(-lambda)];
    let sum = values[0];
    for (let k = 1; k < 200 && 1 - sum > 1e-14; k++) {
      values.push((values[k - 1] * lambda) / k);
      sum += values[k];
    }
    if (1 - sum > 1e-12) throw Error("Poisson truncation tolerance exceeded");
    return values;
  }
  const hp = mass(homeGoals),
    ap = mass(awayGoals);
  let home = 0,
    draw = 0,
    total = 0;
  for (let i = 0; i < hp.length; i++)
    for (let j = 0; j < ap.length; j++) {
      const value = hp[i] * ap[j];
      total += value;
      if (i > j) home += value;
      else if (i === j) draw += value;
    }
  const homeString = (home / total).toFixed(12),
    drawString = (draw / total).toFixed(12);
  const probabilities = validateFootballProbabilities({
    home: homeString,
    draw: drawString,
    away: new Decimal(1).minus(homeString).minus(drawString).toFixed(12),
  });
  return {
    status: "PREDICTED" as const,
    probabilities,
    expectedHomeGoals: homeGoals,
    expectedAwayGoals: awayGoals,
    omittedMass: Math.max(0, 1 - total),
    uncertainty: null,
  };
}
