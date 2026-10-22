import "server-only";
import type { TransactionSql, Sql } from "postgres";
import type { CreditsState } from "@/core/credits-sandbox";
import { fixtureTestAllocationEnabled } from "@/core/card-economy";
import {
  fixtureCommandScope,
  fixtureCommandMembers,
  fixtureCardSport,
} from "@/core/fixture-commerce";
import { fixtureSports, type FixtureSport } from "@/core/fixture-sports";
import { sportPrivateBetaEnabled } from "@/core/sports-private-beta";
import { setSportBetaContext } from "./sports-private-beta";
export async function authorizeFixtureCommand(
  tx: Sql | TransactionSql,
  state: CreditsState,
  command: unknown,
) {
  const sport = fixtureCommandScope(state, command);
  if (!sport) return null;
  if (
    process.env.DOCKED_SPORTS_TEST_COMMERCE !== "true" ||
    !sportPrivateBetaEnabled(sport) ||
    !state.economy ||
    !fixtureTestAllocationEnabled(state.economy, sport)
  )
    throw Error("Test packs and trading are not enabled for this sport.");
  await setSportBetaContext(tx as TransactionSql, sport);
  await tx`select set_config('docked.fixture_commerce','enabled',true)`;
  if (
    !(
      await tx`select sports_feed.fixture_commerce_capability(${sport}) allowed`
    )[0]?.allowed
  )
    throw Error("Verified sport test-economy access required");
  for (const member of fixtureCommandMembers(state, command))
    await tx`select credits_sandbox.assert_sport_fixture_member(${member},${sport})`;
  return sport;
}
export async function fixtureCommerceVisibility(
  tx: TransactionSql,
  state: CreditsState,
) {
  const allowed: FixtureSport[] = [];
  if (process.env.DOCKED_SPORTS_TEST_COMMERCE === "true") {
    await tx`select set_config('docked.nba_private_beta','enabled',true),set_config('docked.multi_sport','isolated-preview',true),set_config('docked.sports_private_beta',${process.env.DOCKED_SPORTS_PRIVATE_BETA === "true" ? "enabled" : "disabled"},true),set_config('docked.fixture_commerce','enabled',true)`;
    for (const sport of Object.keys(fixtureSports) as FixtureSport[]) {
      if (
        !sportPrivateBetaEnabled(sport) ||
        !state.economy ||
        !fixtureTestAllocationEnabled(state.economy, sport)
      )
        continue;
      if (
        (
          await tx`select sports_feed.fixture_commerce_capability(${sport}) allowed`
        )[0]?.allowed
      )
        allowed.push(sport);
    }
  }
  const hidden = Object.keys(state.economy?.instances ?? {}).filter((id) => {
    const sport = fixtureCardSport(state, id);
    return sport && !allowed.includes(sport);
  });
  return { allowed, hidden };
}
