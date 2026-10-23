import "server-only";
import { rosterCardMetadata } from "@/core/roster-card-metadata";
import { authClient, requireRole, requireIdentity } from "./auth";
import { nbaPrivateBetaEnabled } from "@/core/nba-private-beta";
import {
  isBetaSport,
  sportPrivateBetaEnabled,
} from "@/core/sports-private-beta";
import { setSportBetaContext } from "./sports-private-beta";
import { assertPrivatePreview } from "@/core/private-preview.mjs";
import { previewParticipantMatches } from "@/core/preview-owner";
import { verifiedSessionClaims } from "@/core/auth-policy";
import { db, rateLimit } from "./db";
import productionManifest from "../../config/hosted-production.json";
import {
  sandboxScoreView,
  sandboxHistoricalRanks,
} from "@/core/sandbox-score-view";
import {
  assertSportSandbox,
  sandboxCommand,
  sandboxRecommendation,
  type SandboxState,
} from "@/core/sport-sandbox";
export async function sportSandbox(sport: string, input?: unknown) {
  assertSportSandbox();
  const privateBeta = nbaPrivateBetaEnabled();
  if (privateBeta && !sportPrivateBetaEnabled(sport))
    throw Error("Sport beta access required");
  const who = await sandboxIdentity();
  if (!["afl", "nrl", "basketball", "football"].includes(sport))
    throw Error("Unsupported sandbox sport");
  if (!(await rateLimit(`sport-sandbox:${who.user.id}`, 40, 60)))
    throw Error("Please wait before retrying");
  const cmd = input === undefined ? null : sandboxCommand.parse(input);
  if (cmd && cmd.sport !== sport) throw Error("Sport context changed");
  return await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.multi_sport','isolated-preview',true)`;
    if (privateBeta && isBetaSport(sport)) await setSportBetaContext(tx, sport);
    const read = async () => {
      const state = (
        await tx`select sports_feed.sport_sandbox_state(${sport}) state`
      )[0].state as SandboxState;
      if (privateBeta) {
        // The shared, immutable team name uses the existing production consent
        // guard as well as sport admission. Supply its transaction-local context
        // exactly as the NFL reader does; never bypass that guard for other sports.
        await tx`select set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true),set_config('docked.fantasy_production',${productionManifest.supabaseProjectRef},true),set_config('docked.fantasy_preview','',true)`;
        state.team_name =
          (await tx`select fantasy.my_team_name() name`)[0].name ?? undefined;
      }
      if (
        ["afl", "nrl"].includes(sport) ||
        (sport === "basketball" &&
          state.competitions.some(
            (c) =>
              c.rules.lineup_version === "docked-nba-weekly-lineup-proposal-v1",
          ))
      ) {
        const journals = (
          await tx`select sports_feed.sandbox_sport_journals(${sport}) journals`
        )[0].journals;
        state.scores = sandboxScoreView(state, journals);
        state.recommendationRanks = sandboxHistoricalRanks(state, journals);
      }
      state.cards = state.cards.map((c) => ({
        ...c,
        ...rosterCardMetadata(
          c.canonical_player_id ?? c.player_id,
          sport,
          c.team ?? "",
        ),
      }));
      state.entries = state.entries.map((e) => ({
        ...e,
        snapshot: e.snapshot.map((c) => ({
          ...c,
          ...rosterCardMetadata(
            c.canonical_player_id ?? c.player_id,
            sport,
            c.team ?? "",
          ),
        })),
      }));
      return state;
    };
    const before = await read();
    if (cmd && !before.competitions.some((c) => c.id === cmd.competition_id))
      throw Error("Competition context changed");
    if (cmd?.action === "auto_select")
      return {
        state: before,
        recommendation: sandboxRecommendation(before, cmd.competition_id),
      };
    if (cmd)
      await tx`select sports_feed.sport_sandbox_command(${cmd.action},${tx.json({ competition_id: cmd.competition_id, revision: cmd.revision, selections: cmd.selections })}::jsonb,${cmd.request_id}::uuid)`;
    return { state: cmd ? await read() : before };
  });
}

async function sandboxIdentity() {
  if (nbaPrivateBetaEnabled()) return requireIdentity();
  if (!assertPrivatePreview(process.env))
    return requireRole(["owner", "admin"]);
  const client = await authClient();
  if (!client) throw Error("Authentication required");
  const session = await client.auth.getSession();
  const token = session.data.session?.access_token;
  if (session.error || !token) throw Error("Authentication required");
  const verified = await client.auth.getUser(token);
  if (
    verified.error ||
    !previewParticipantMatches(verified.data.user, process.env)
  )
    throw Error("Authentication required");
  const claims = verifiedSessionClaims(token, verified.data.user!.id);
  if (!claims || claims.aal !== "aal2") throw Error("Privileged MFA required");
  // SQL independently validates the active session, MFA, ban status and allowlist.
  return {
    user: verified.data.user!,
    sessionId: claims.sessionId,
    aal: claims.aal,
  };
}
