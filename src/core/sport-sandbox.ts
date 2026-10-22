import { z } from "zod";
import { autoSelect } from "./lineup-auto-select";
import { fitsSlot, type SlotSelection, type SevenCard } from "./nfl-seven";
import type { LineupConfiguration } from "./sport-configuration";
import type { CollectibleIdentity } from "../components/collectible-face";
import { assertFantasyEnvironment } from "./fantasy";
import { assertPrivatePreview } from "./private-preview.mjs";
import type { SandboxScores } from "./sandbox-score-view";
import { nbaPrivateBetaEnabled } from "./nba-private-beta";
export function assertSportSandbox(
  env: Record<string, string | undefined> = process.env,
) {
  if (nbaPrivateBetaEnabled(env)) return;
  // Hosted Preview already binds the exact project, restricted application role
  // and disabled capabilities. The legacy local harness uses a postgres binding
  // and must not force the hosted application to adopt that privileged role.
  if (!assertPrivatePreview(env)) assertFantasyEnvironment(env);
  if (env.DOCKED_MULTI_SPORT_SANDBOX !== "true")
    throw Error("Sport sandbox is disabled");
}
export type SandboxCard = SevenCard &
  CollectibleIdentity & { sport: string; owner_id: string; player_id: string };
export type SandboxState = {
  scores?: SandboxScores;
  /** Server-derived averages of up to five completed, prior-period games. */
  recommendationRanks?: Record<string, Record<string, number>>;
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
    snapshot: (SandboxCard & {
      slot: string;
      card_id: string;
      fixture_ids?: string[];
    })[];
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
  if (
    state.drafts.some((d) => d.competition_id === id && d.selections.length > 0)
  )
    throw Error("Draft already saved; replace players manually");
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
  // Only server-projected prior games can rank a card. Unknown performance is not zero.
  return autoSelect(
    cards.map((card) => ({
      ...card,
      value:
        state.recommendationRanks?.[id]?.[
          card.canonical_player_id ?? card.player_id
        ] ?? null,
    })),
    c.rules.mode,
    [],
    cfg,
  );
}
