import { z } from "zod";
import { autoSelect } from "./lineup-auto-select";
import { fitsSlot, type SlotSelection, type SevenCard } from "./nfl-seven";
import type { LineupConfiguration } from "./sport-configuration";
import type { CollectibleIdentity } from "../components/collectible-face";
import { assertFantasyEnvironment } from "./fantasy";
export function assertSportSandbox(
  env: Record<string, string | undefined> = process.env,
) {
  assertFantasyEnvironment(env);
  if (env.DOCKED_MULTI_SPORT_SANDBOX !== "true")
    throw Error("Sport sandbox is disabled");
}
export type SandboxCard = SevenCard &
  CollectibleIdentity & { sport: string; owner_id: string; player_id: string };
export type SandboxState = {
  user_id: string;
  sport: string;
  server_time: string;
  cards: SandboxCard[];
  configurations: Record<string, LineupConfiguration>;
  competitions: {
    id: string;
    name: string;
    sport: string;
    season: string;
    round: number;
    locks_at: string;
    rules: { mode: "SALARY_CAP" | "OPEN"; lineup_version: string };
  }[];
  drafts: {
    competition_id: string;
    revision: number;
    updated_at: string;
    selections: SlotSelection[];
  }[];
  entries: {
    competition_id: string;
    user_id: string;
    revision: number;
    updated_at: string;
    snapshot: (SandboxCard & { slot: string; card_id: string })[];
  }[];
  continuity: {
    established: Record<string, boolean>;
    rollovers: {
      competition_id: string;
      omitted: { slot: string; reason: string }[];
    }[];
  };
};
export const sandboxCommand = z
  .object({
    sport: z.enum(["afl", "nrl", "basketball", "football"]),
    action: z.enum(["seven_draft", "seven_enter", "auto_select"]),
    competition_id: z.uuid(),
    revision: z.number().int().min(0),
    selections: z
      .array(z.object({ slot: z.string().max(20), card: z.uuid() }).strict())
      .max(30),
    request_id: z.uuid(),
  })
  .strict();
/** Trusted server projection; recommendations never submit or mutate the entry. */
export function sandboxRecommendation(state: SandboxState, id: string) {
  const c = state.competitions.find((c) => c.id === id);
  if (!c || Date.parse(c.locks_at) <= Date.parse(state.server_time))
    throw Error("Round unavailable or locked");
  if (state.continuity.established[`${c.sport}:${c.rules.mode}`])
    throw Error("Team established; replace players manually");
  const cfg = state.configurations[c.rules.lineup_version];
  if (!cfg) throw Error("Lineup configuration unavailable");
  const cards = state.cards.filter(
    (card) =>
      card.sport === c.sport &&
      card.owner_id === state.user_id &&
      card.status === "active" &&
      !card.listed &&
      cfg.slots.some((s) => fitsSlot(card, s.positions)),
  );
  // No licensed historic feed has been configured: unknown performance is not zero.
  return autoSelect(
    cards.map((c) => ({ ...c, value: null })),
    c.rules.mode,
    [],
    cfg,
  );
}
