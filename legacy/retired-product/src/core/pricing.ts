import Decimal from "decimal.js";
import { createHash } from "node:crypto";
import { z } from "zod";

export type Evidence =
  "retrospective_backtest" | "forward_paper" | "live_published" | "demo";
export type Rules = {
  eventId: string;
  competition: string;
  participants: string[];
  market: "football_1x2" | "nba_moneyline";
  period: "full_game";
  overtime: boolean;
  draw: boolean;
  line: null;
  settlement: string;
  outcomes: string[];
};
export type Quote = {
  id: string;
  bookmaker: string;
  operator: string;
  approved: boolean;
  rules: Rules;
  prices: Record<string, string>;
  sourceAt: string;
  snapshotAt: string;
  receivedAt: string;
  suspended: boolean;
};
export type Strategy = {
  version: string;
  method: string;
  minEV: string;
  minOdds: string;
  maxOdds: string;
  maxEV: string;
  maxAgeSeconds: number;
  maxSkewSeconds: number;
  maxDisagreement: string;
  minReferences: number;
  safetySeconds: number;
  windowsSeconds: readonly number[];
  windowToleranceSeconds: number;
  tick: string;
  competitions: readonly string[];
  selectionRule: string;
  maxDelayedSeconds: number;
  aggregation: string;
};
function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value))
    if (child && typeof child === "object") deepFreeze(child);
  return Object.freeze(value);
}
export const strategyV1 = deepFreeze({
  version: "reference-v1.0.0",
  method: "proportional-equal-independent",
  minEV: "0.03",
  minOdds: "1.50",
  maxOdds: "5.00",
  maxEV: "0.20",
  maxAgeSeconds: 180,
  maxSkewSeconds: 90,
  maxDisagreement: "0.08",
  minReferences: 2,
  safetySeconds: 600,
  windowsSeconds: [21600, 3600],
  windowToleranceSeconds: 120,
  tick: "0.01",
  competitions: ["soccer_epl", "soccer_spain_la_liga", "basketball_nba"],
  selectionRule: "EV-desc-selection-bookmaker-ascending",
  maxDelayedSeconds: 900,
  aggregation: "normalise-each-then-equal-operator-weight",
});
const decimalBound = (minimum: number, maximum: number) =>
  z.string().refine((s) => {
    try {
      const n = new Decimal(s);
      return n.isFinite() && n.gte(minimum) && n.lte(maximum);
    } catch {
      return false;
    }
  });
const strategySchema = z
  .object({
    version: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,100}$/),
    method: z.literal("proportional-equal-independent"),
    minEV: decimalBound(0.01, 0.2),
    minOdds: decimalBound(1.5, 5),
    maxOdds: decimalBound(1.5, 5),
    maxEV: decimalBound(0.01, 0.2),
    maxAgeSeconds: z.number().int().positive().max(180),
    maxSkewSeconds: z.number().int().nonnegative().max(90),
    maxDisagreement: decimalBound(0, 0.08),
    minReferences: z.number().int().min(2).max(20),
    safetySeconds: z.number().int().min(600),
    windowsSeconds: z.array(z.number().int().positive()).min(1).max(10),
    windowToleranceSeconds: z.number().int().min(0).max(120),
    tick: z.literal("0.01"),
    competitions: z
      .array(z.enum(["soccer_epl", "soccer_spain_la_liga", "basketball_nba"]))
      .min(1)
      .max(3),
    selectionRule: z.literal("EV-desc-selection-bookmaker-ascending"),
    maxDelayedSeconds: z.number().int().min(1).max(900),
    aggregation: z.literal("normalise-each-then-equal-operator-weight"),
  })
  .strict()
  .refine(
    (c) =>
      new Decimal(c.minEV).lte(c.maxEV) &&
      new Decimal(c.minOdds).lte(c.maxOdds) &&
      new Set(c.competitions).size === c.competitions.length &&
      new Set(c.windowsSeconds).size === c.windowsSeconds.length &&
      c.windowsSeconds.every(
        (w, i) =>
          w >= c.safetySeconds && (i === 0 || w < c.windowsSeconds[i - 1]),
      ),
    "Inconsistent strategy bounds or decision window ordering",
  );
/** Supported engine configuration only. A valid configuration is not a research or live approval. */
export function validateStrategy(value: unknown): Strategy {
  return deepFreeze(strategySchema.parse(value));
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => compareKeys(a, b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  if (value === undefined) return "null";
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Cannot hash non-finite evidence");
  return JSON.stringify(value);
}
// Pin the original collation rather than inheriting a deployment's locale.
// Runtime/version is retained with each research code commit.
export const compareKeys = (a: string, b: string) => a.localeCompare(b, "en");
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export const configHash = hash(strategyV1);
export function removeMargin(
  prices: Record<string, string>,
): Record<string, Decimal> {
  const entries = Object.entries(prices);
  if (
    entries.length < 2 ||
    entries.some(([, o]) => !new Decimal(o).isFinite() || new Decimal(o).lte(1))
  )
    throw new Error("Invalid complete market");
  const sum = entries.reduce(
    (s, [, o]) => s.plus(new Decimal(1).div(o)),
    new Decimal(0),
  );
  return Object.fromEntries(
    entries.map(([s, o]) => [s, new Decimal(1).div(o).div(sum)]),
  );
}
export function payoffEV(states: { probability: string; netPayoff: string }[]) {
  if (
    states.length < 2 ||
    states.some(
      (s) =>
        !new Decimal(s.probability).isFinite() ||
        new Decimal(s.probability).lt(0) ||
        !new Decimal(s.netPayoff).isFinite(),
    ) ||
    !states.reduce((p, s) => p.plus(s.probability), new Decimal(0)).eq(1)
  )
    throw new Error("Complete probability vector required");
  return states.reduce(
    (ev, s) => ev.plus(new Decimal(s.probability).mul(s.netPayoff)),
    new Decimal(0),
  );
}
export function binaryPrice(
  probability: string,
  odds: string,
  requiredEV = "0.03",
  tick = "0.01",
) {
  const p = new Decimal(probability),
    o = new Decimal(odds),
    t = new Decimal(tick);
  if (
    !p.isFinite() ||
    p.lte(0) ||
    p.gte(1) ||
    !o.isFinite() ||
    o.lte(1) ||
    !t.isFinite() ||
    t.lte(0) ||
    !new Decimal(requiredEV).isFinite() ||
    new Decimal(requiredEV).lt(0)
  )
    throw new Error("Invalid binary win/loss inputs");
  return {
    probability: p.toString(),
    ev: p.mul(o).minus(1).toString(),
    fairOdds: new Decimal(1).div(p).toString(),
    minimumOdds: new Decimal(1)
      .plus(requiredEV)
      .div(p)
      .div(t)
      .ceil()
      .mul(t)
      .toFixed(t.decimalPlaces()),
  };
}
export function oddsDisplay(
  odds: string,
  format: "decimal" | "fractional" | "american",
) {
  const o = new Decimal(odds);
  if (!o.isFinite() || o.lte(1)) throw new Error("Invalid odds");
  if (format === "decimal") return o.toFixed(2);
  if (format === "american")
    return o.gte(2)
      ? "+" + o.minus(1).mul(100).toFixed(0)
      : new Decimal(-100).div(o.minus(1)).toFixed(0);
  const n = o.minus(1).mul(10000).round().toNumber();
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(n, 10000);
  return `${n / g}/${10000 / g}`;
}
export function decisionWindow(
  start: string,
  now: string,
  config: Strategy = strategyV1,
) {
  const delta = (Date.parse(start) - Date.parse(now)) / 1000;
  if (!Number.isFinite(delta) || delta < config.safetySeconds) return null;
  return (
    config.windowsSeconds.find(
      (w) => delta <= w && delta >= w - config.windowToleranceSeconds,
    ) ?? null
  );
}
export type Candidate = ReturnType<typeof binaryPrice> & {
  eventId: string;
  selection: string;
  offer: Quote;
  references: Quote[];
  decisionAt: string;
  startAt: string;
  configHash: string;
  window: number;
};
export type Evaluation = {
  candidates: Candidate[];
  eligibleCandidates: Candidate[];
  universe: {
    eventId: string;
    selection: string;
    bookmaker: string;
    probability: string;
    referenceIds: string[];
    referenceSourceAt: string;
  }[];
  rejections: { quoteId: string; reason: string }[];
};
function quoteProblem(
  q: Quote,
  rules: Rules,
  now: number,
  config: Strategy,
): string | null {
  if (
    ![q.id, q.bookmaker, q.operator].every(
      (v) => typeof v === "string" && v.trim().length > 0,
    )
  )
    return "missing_identity_or_operator";
  if (hash(q.rules) !== hash(rules)) return "market_mismatch";
  if (!q.approved || q.suspended) return "unapproved_or_suspended";
  if (
    canonical(Object.keys(q.prices).sort()) !==
    canonical([...rules.outcomes].sort())
  )
    return "incomplete_market";
  const times = [q.sourceAt, q.snapshotAt, q.receivedAt].map(Date.parse);
  if (times.some((t) => !Number.isFinite(t) || t > now))
    return "future_or_invalid_timestamp";
  if (times[0] > times[1] || times[1] > times[2]) return "timestamp_order";
  if (times.some((t) => now - t > config.maxAgeSeconds * 1000)) return "stale";
  try {
    const implied = Object.values(q.prices).reduce(
      (s, o) => s.plus(new Decimal(1).div(o)),
      new Decimal(0),
    );
    removeMargin(q.prices);
    if (implied.lt("0.95") || implied.gt("1.25")) return "implausible_market";
  } catch {
    return "invalid_price";
  }
  return null;
}
export function evaluate(
  input: { rules: Rules; startAt: string; decisionAt: string; quotes: Quote[] },
  config: Strategy = strategyV1,
): Evaluation {
  const { rules, startAt, decisionAt } = input;
  const now = Date.parse(decisionAt);
  const window = decisionWindow(startAt, decisionAt, config);
  const rejections: Evaluation["rejections"] = [],
    candidates: Candidate[] = [],
    universe: Evaluation["universe"] = [];
  const deny = (reason: string): Evaluation => ({
    candidates: [],
    eligibleCandidates: [],
    universe: [],
    rejections: [{ quoteId: "market", reason }],
  });
  if (window === null) return deny("outside_decision_window");
  if (!config.competitions.includes(rules.competition))
    return deny("unsupported_competition");
  if (
    (rules.market === "nba_moneyline" &&
      rules.competition !== "basketball_nba") ||
    (rules.market === "football_1x2" &&
      !["soccer_epl", "soccer_spain_la_liga"].includes(rules.competition))
  )
    return deny("competition_market_mismatch");
  if (
    !rules.eventId?.trim() ||
    rules.participants.some((p) => !p.trim()) ||
    new Set(rules.outcomes).size !== rules.outcomes.length ||
    rules.participants.length !== 2 ||
    new Set(rules.participants).size !== 2 ||
    rules.line !== null ||
    rules.period !== "full_game"
  )
    return deny("unsupported_rules");
  if (
    rules.market === "football_1x2" &&
    (rules.overtime ||
      !rules.draw ||
      rules.settlement !== "regulation_90_plus_stoppage" ||
      canonical([...rules.outcomes].sort()) !==
        canonical([...rules.participants, "Draw"].sort()))
  )
    return deny("unsupported_rules");
  if (
    rules.market === "nba_moneyline" &&
    (!rules.overtime ||
      rules.draw ||
      rules.settlement !== "full_game_including_overtime" ||
      canonical([...rules.outcomes].sort()) !==
        canonical([...rules.participants].sort()))
  )
    return deny("unsupported_rules");
  if (!["football_1x2", "nba_moneyline"].includes(rules.market))
    return deny("unsupported_payoff");
  // An ambiguous duplicate invalidates every member of that group. Accepting the
  // first quote would make selection depend on provider payload ordering.
  const ids = new Map<string, number>();
  const books = new Map<string, number>();
  for (const q of input.quotes) {
    ids.set(q.id, (ids.get(q.id) ?? 0) + 1);
    books.set(q.bookmaker, (books.get(q.bookmaker) ?? 0) + 1);
  }
  const valid: Quote[] = [];
  for (const q of input.quotes) {
    const reason =
      ids.get(q.id)! > 1 || books.get(q.bookmaker)! > 1
        ? "duplicate_quote"
        : quoteProblem(q, rules, now, config);
    if (reason) rejections.push({ quoteId: q.id, reason });
    else valid.push(q);
  }
  for (const offer of valid) {
    const operators = new Set<string>();
    const refs = valid
      .filter(
        (q) => q.operator !== offer.operator && q.bookmaker !== offer.bookmaker,
      )
      .sort((a, b) => compareKeys(a.bookmaker, b.bookmaker))
      .filter((q) => {
        if (operators.has(q.operator)) return false;
        operators.add(q.operator);
        return true;
      });
    const reject = (reason: string) =>
      rejections.push({ quoteId: offer.id, reason });
    if (refs.length < config.minReferences) {
      reject("insufficient_independent_references");
      continue;
    }
    const times = [offer, ...refs].map((q) => Date.parse(q.sourceAt));
    if (
      Math.max(...times) - Math.min(...times) >
      config.maxSkewSeconds * 1000
    ) {
      reject("source_skew");
      continue;
    }
    const vectors = refs.map((q) => removeMargin(q.prices));
    for (const selection of rules.outcomes) {
      const ps = vectors.map((v) => v[selection]);
      if (
        Decimal.max(...ps)
          .minus(Decimal.min(...ps))
          .gt(config.maxDisagreement)
      ) {
        reject("reference_disagreement");
        continue;
      }
      const p = ps.reduce((s, x) => s.plus(x), new Decimal(0)).div(ps.length);
      const odds = new Decimal(offer.prices[selection]);
      universe.push({
        eventId: rules.eventId,
        selection,
        bookmaker: offer.bookmaker,
        probability: p.toString(),
        referenceIds: refs.map((q) => q.id),
        referenceSourceAt: new Date(
          Math.min(...refs.map((q) => Date.parse(q.sourceAt))),
        ).toISOString(),
      });
      if (odds.lt(config.minOdds) || odds.gt(config.maxOdds)) continue;
      const price = binaryPrice(
        p.toString(),
        odds.toString(),
        config.minEV,
        config.tick,
      );
      if (new Decimal(price.ev).gt(config.maxEV)) {
        reject("suspicious_edge_requires_review");
        continue;
      }
      if (new Decimal(price.ev).lt(config.minEV) || odds.lt(price.minimumOdds))
        continue;
      candidates.push({
        ...price,
        eventId: rules.eventId,
        selection,
        offer,
        references: refs,
        decisionAt,
        startAt,
        window,
        configHash: hash(config),
      });
    }
  }
  candidates.sort(
    (a, b) =>
      new Decimal(b.ev).cmp(a.ev) ||
      compareKeys(a.selection, b.selection) ||
      compareKeys(a.offer.bookmaker, b.offer.bookmaker),
  );
  return {
    candidates: candidates.slice(0, 1),
    eligibleCandidates: candidates,
    universe,
    rejections,
  };
}
