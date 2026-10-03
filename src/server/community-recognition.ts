import "server-only";
import { config } from "./config";
import { communityAccess } from "./community-policy";
import { withCommunityActor, setCommunityClaims } from "./community-social";
import { requireRole } from "./auth";
import { db } from "./db";
import { phase5Hash } from "@/core/phase5-hash";
import { recognitionInputs } from "./community-recognition-inputs";
import {
  completedRecognitionWeek,
  rankCommunityRecognition,
  recognitionRuleV1,
  type RecognizedEdge,
} from "@/core/community-recognition";

export type CommunityRecognition = {
  status: "READY" | "NOT_CONFIGURED" | "RESTRICTED" | "UNAVAILABLE";
  message: string;
  asOf: string;
  ruleVersion: string;
  trending: RecognizedEdge[];
  weekly: {
    start: string;
    end: string;
    status:
      | "PUBLISHED"
      | "NO_QUALIFIER"
      | "AWAITING_REVIEW"
      | "WITHHELD"
      | "UNAVAILABLE";
    winner: RecognizedEdge | null;
    snapshotId: string | null;
  };
};
// Private SQL projection is isolated so its visibility predicates can be tested against PostgreSQL.
function empty(
  status: CommunityRecognition["status"],
  message: string,
  asOf: string,
): CommunityRecognition {
  const week = completedRecognitionWeek(asOf);
  return {
    status,
    message,
    asOf,
    ruleVersion: recognitionRuleV1.version,
    trending: [],
    weekly: { ...week, status: "UNAVAILABLE", winner: null, snapshotId: null },
  };
}
export async function communityRecognition(): Promise<CommunityRecognition> {
  const at = new Date().toISOString();
  if (!config().database || !config().auth)
    return empty(
      "NOT_CONFIGURED",
      "Community recognition requires connected, eligible community records.",
      at,
    );
  try {
    if (!(await communityAccess("community_edges")).allowed)
      return empty(
        "RESTRICTED",
        "Community recognition is unavailable for this account or region.",
        at,
      );
    return await withCommunityActor(
      "community_edges",
      false,
      async (tx, _who, viewer) => {
        const candidates = await recognitionInputs(tx, viewer, at),
          ranked = rankCommunityRecognition(candidates, at);
        const snapshots =
          await tx`select id,payload,payload_hash from private.community_recognition_snapshots where rule_version=${ranked.ruleVersion} and week_start=${ranked.week.start}::timestamptz order by as_of,id limit 1`;
        const snapshot = snapshots[0];
        const lockedId = snapshot?.payload?.winner?.edgeId as
          string | undefined;
        const current = lockedId
          ? candidates.find((c) => c.edge.id === lockedId)
          : null;
        // Preserve the first complete-week decision. Removed/private/corrected records withdraw it; never silently substitute a winner.
        const safe =
          !!snapshot && snapshot.payload_hash === phase5Hash(snapshot.payload);
        const winner =
          safe &&
          current?.viewerVisible &&
          current.integrityClear &&
          ranked.canonicalWeeklyWinner?.edge.id === lockedId
            ? ranked.canonicalWeeklyWinner
            : null;
        return {
          status: "READY",
          message:
            "Interest is not performance. Versioned eligibility and unique-member checks apply.",
          asOf: at,
          ruleVersion: ranked.ruleVersion,
          trending: ranked.trending,
          weekly: {
            ...ranked.week,
            snapshotId: snapshot ? String(snapshot.id) : null,
            winner,
            status: !snapshot
              ? ranked.canonicalWeeklyWinner
                ? "AWAITING_REVIEW"
                : "NO_QUALIFIER"
              : !safe
                ? "UNAVAILABLE"
                : !lockedId
                  ? "NO_QUALIFIER"
                  : winner
                    ? "PUBLISHED"
                    : "WITHHELD",
          },
        };
      },
    );
  } catch {
    return empty(
      "UNAVAILABLE",
      "Community recognition is temporarily unavailable. No ranking has been inferred.",
      at,
    );
  }
}
/** Explicit staff capture, not a member-facing award mutation. No external notifications. */
export async function captureWeeklyRecognition() {
  const who = await requireRole(["owner", "admin", "analyst"]);
  return await db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    const at = new Date().toISOString(),
      ranked = rankCommunityRecognition(
        await recognitionInputs(tx, null, at),
        at,
      );
    const payload = {
      rule: recognitionRuleV1,
      week: ranked.week,
      asOf: at,
      // Preserve evidence without freezing personal display names or handles into an immutable snapshot.
      winner: ranked.canonicalWeeklyWinner
        ? {
            edgeId: ranked.canonicalWeeklyWinner.edge.id,
            profileId: ranked.canonicalWeeklyWinner.edge.profileId,
            settledAt: ranked.canonicalWeeklyWinner.edge.settledAt,
            submissionOdds: ranked.canonicalWeeklyWinner.edge.odds,
            netUnits: ranked.canonicalWeeklyWinner.netUnits,
            uniqueMembers: ranked.canonicalWeeklyWinner.uniqueMembers,
            uniqueReactions: ranked.canonicalWeeklyWinner.uniqueReactions,
            uniqueCommenters: ranked.canonicalWeeklyWinner.uniqueCommenters,
          }
        : null,
      reviewEdgeIds: ranked.reviewEdgeIds,
    };
    const rows =
      await tx`insert into private.community_recognition_snapshots(rule_version,week_start,week_end,as_of,payload_hash,payload,actor)
      values(${ranked.ruleVersion},${ranked.week.start},${ranked.week.end},${at},${phase5Hash(payload)},${tx.json(payload)},${who.user.id}) returning id`;
    return String(rows[0].id);
  });
}
export async function recognitionAudit() {
  const who = await requireRole(["owner", "admin", "analyst", "auditor"]);
  return await db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    const at = new Date().toISOString(),
      candidates = await recognitionInputs(tx, null, at);
    const ranked = rankCommunityRecognition(candidates, at);
    return {
      asOf: at,
      ruleVersion: ranked.ruleVersion,
      candidatesEvaluated: candidates.length,
      trendingShown: ranked.trending.length,
      burstReviewIds: ranked.reviewEdgeIds,
      week: ranked.week,
      weeklyCandidate: ranked.canonicalWeeklyWinner?.edge.id ?? null,
    };
  });
}
