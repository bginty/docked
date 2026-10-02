import { z } from "zod";
import type { OddsProvider, Capabilities } from "./contracts";
import type { Quote, Rules } from "@/core/pricing";
import { hash } from "@/core/pricing";
const outcome = z.object({ name: z.string(), price: z.number().gt(1) });
const event = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string().datetime(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(
    z.object({
      key: z.string(),
      last_update: z.string().datetime(),
      markets: z.array(
        z.object({
          key: z.string(),
          last_update: z.string().datetime().optional(),
          outcomes: z.array(outcome),
        }),
      ),
    }),
  ),
});
export type Mapping = {
  bookmakers: Record<string, { operator: string; approved: boolean }>;
  events: Record<string, { rules: Rules; startAt: string }>;
};
export class TheOddsApi implements OddsProvider {
  id = "the-odds-api";
  capabilities: Capabilities = {
    current: true,
    historical: true,
    results: false,
    sourceTimestamps: true,
    marketRules: false,
    liquidity: false,
    limits: false,
    commission: false,
    retention: false,
    display: false,
    export: false,
  };
  constructor(
    private options: {
      key: string;
      rights: string;
      remaining: number;
      regions: string;
      mapping: Mapping;
      allowPolling: boolean;
    },
    private fetcher: typeof fetch = fetch,
  ) {}
  async fetch(sport: string, asOf?: string) {
    const o = this.options;
    const forecast = (asOf ? 10 : 1) * o.regions.split(",").length;
    if (!o.allowPolling || !o.key || !o.rights)
      throw new Error("Provider activation/rights pending");
    if (o.remaining < forecast) throw new Error("Quota exhausted");
    if (
      !["soccer_epl", "soccer_spain_la_liga", "basketball_nba"].includes(sport)
    )
      throw new Error("Unsupported sport");
    const url = new URL(
      `https://api.the-odds-api.com/v4/${asOf ? "historical/" : ""}sports/${sport}/odds`,
    );
    url.search = new URLSearchParams({
      apiKey: o.key,
      regions: o.regions,
      markets: "h2h",
      oddsFormat: "decimal",
      ...(asOf ? { date: asOf } : {}),
    }).toString();
    let response: Response;
    try {
      response = await this.fetcher(url, {
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
    } catch {
      throw new Error("Odds provider unavailable");
    }
    if (!response.ok) throw new Error(`Odds provider HTTP ${response.status}`);
    const raw = await response.json();
    const receivedAt = new Date().toISOString();
    const snapshotAt = asOf
      ? z.string().datetime().parse(raw.timestamp)
      : receivedAt;
    if (asOf && Date.parse(snapshotAt) > Date.parse(asOf))
      throw new Error("Historical look-ahead rejected");
    const events = z.array(event).parse(asOf ? raw.data : raw);
    const quotes: Quote[] = [];
    for (const e of events) {
      const match = o.mapping.events[e.id];
      if (
        !match ||
        match.startAt !== e.commence_time ||
        hash([...match.rules.participants].sort()) !==
          hash([e.home_team, e.away_team].sort())
      )
        continue;
      for (const b of e.bookmakers) {
        const operator = o.mapping.bookmakers[b.key];
        if (!operator?.approved) continue;
        const m = b.markets.find((x) => x.key === "h2h");
        if (!m) continue;
        const sourceAt = m.last_update ?? b.last_update;
        const prices = Object.fromEntries(
          m.outcomes.map((x) => [x.name, String(x.price)]),
        );
        quotes.push({
          id: hash({ event: e.id, book: b.key, sourceAt, prices }),
          bookmaker: b.key,
          operator: operator.operator,
          approved: true,
          rules: match.rules,
          prices,
          sourceAt,
          snapshotAt,
          receivedAt,
          suspended: false,
        });
      }
    }
    return {
      raw,
      quotes,
      remaining: Number(response.headers.get("x-requests-remaining") ?? 0),
      used: Number(response.headers.get("x-requests-used") ?? 0),
      receivedAt,
    };
  }
}
export function forecastCredits(input: {
  sports: number;
  regions: number;
  markets: number;
  intervalMinutes: number;
  hoursPerDay: number;
  days: number;
  historical?: boolean;
}) {
  return (
    Math.ceil((input.hoursPerDay * 60) / input.intervalMinutes) *
    input.days *
    input.sports *
    input.regions *
    input.markets *
    (input.historical ? 10 : 1)
  );
}
