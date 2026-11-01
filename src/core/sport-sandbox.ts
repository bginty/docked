import { z } from "zod";
import { eligibleInRound, isFreeCore } from "./free-core";
import { nbaRarityWeeklyVersion } from "./additional-sport-statistics";
import { rarityPoints, rarityRule } from "./card-rarity";
import { autoSelect } from "./lineup-auto-select";
import { fitsSlot, type SlotSelection, type SevenCard } from "./nfl-seven";
import type { LineupConfiguration } from "./sport-configuration";
import type { CollectibleIdentity } from "../components/collectible-face";
import { assertFantasyEnvironment } from "./fantasy";
import { assertPrivatePreview } from "./private-preview.mjs";
import type { SandboxScores } from "./sandbox-score-view";
import { nbaPrivateBetaEnabled } from "./nba-private-beta";
import type { RosterBetaEvidence } from "./roster-beta";
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
  CollectibleIdentity & {
    sport: string;
    owner_id: string;
    player_id: string;
    inventory_source?:
      "credits-fixture-v1" | "roster-beta-core-v1" | "public-free-core-v1";
    inventory_class?: "real-roster-beta-v1";
    roster_source?: RosterBetaEvidence;
    season?: string;
  };
export type SandboxState = {
  public_play?: boolean;
  scores?: SandboxScores;
  fixtures?: Record<string, { scheduledAt: string; status: string }[]>;
  /** Server-derived averages of up to five completed, prior-period games. */
  recommendationRanks?: Record<string, Record<string, number>>;
  user_id: string;
  team_name?: string;
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
    fixture_kind?: "practice" | "verified";
    rules: {
      mode: "SALARY_CAP" | "OPEN";
      lineup_version: string;
      scoring_version?: string;
      replaces_competition?: string;
    };
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
      multiplierTenths?: number;
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
      // Projected Core IDs use PostgreSQL's full UUID space (MD5), not an
      // RFC version/variant. SQL still resolves eligibility for this member.
      .array(z.object({ slot: z.string().max(20), card: z.guid() }).strict())
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
  const realRoster = state.cards.some(
    (c) => c.inventory_class === "real-roster-beta-v1",
  );
  const cards = state.cards.filter(
    (card) =>
      card.sport === c.sport &&
      card.owner_id === state.user_id &&
      card.status === "active" &&
      eligibleInRound(card, id) &&
      (!realRoster ||
        isFreeCore(card) ||
        card.inventory_class === "real-roster-beta-v1") &&
      !card.listed &&
      cfg.slots.some((s) => fitsSlot(card, s.positions)),
  );
  // Only server-projected prior games can rank a card. Unknown performance is not zero.
  return autoSelect(
    cards.map((card) => {
      const base =
        state.recommendationRanks?.[id]?.[
          card.canonical_player_id ?? card.player_id
        ] ?? null;
      return {
        ...card,
        value:
          base === null
            ? null
            : c.rules.scoring_version === nbaRarityWeeklyVersion
              ? rarityPoints(base, rarityRule(card.tier).multiplierTenths)
              : base,
      };
    }),
    c.rules.mode,
    [],
    cfg,
  );
}
