import "server-only";
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { withPreviewTesterCapability } from "./preview-testers";
import {
  buildPreviewFixture,
  assertPreviewReviewFresh,
  previewFixtureOptions,
} from "@/core/preview-market-fixture";
import {
  previewPriceLabel,
  previewReviewInput,
  previewSubmitInput,
  type PreviewFixtureResponse,
  type PreviewReview,
} from "@/core/preview-market-contracts";
import { hash } from "@/core/pricing";

const iso = (value: unknown) =>
  (value instanceof Date ? value : new Date(String(value))).toISOString();
async function actorProfile(tx: TransactionSql, actor: string) {
  const [row] =
    await tx`select id from private.social_profiles where user_id=${actor} and status='active' for share`;
  if (!row) throw new Error("Create an active preview community profile first");
  return String(row.id);
}
function restoreReview(row: Record<string, unknown>): PreviewReview {
  const built = buildPreviewFixture(
    { fixtureId: row.fixture_id, selection: row.selection },
    String(row.id),
    iso(row.observed_at),
  );
  if (
    built.review.reviewToken !== row.payload_hash ||
    hash(row.payload) !== row.payload_hash
  )
    throw new Error("Preview evidence mismatch");
  return built.review;
}
export async function previewEdgeOptions(): Promise<PreviewFixtureResponse> {
  return withPreviewTesterCapability(
    "preview_market_fixtures",
    async (tx, who) => {
      const profile = await actorProfile(tx, who.user.id);
      const rows =
        await tx`select s.*,e.id as edge_id,e.submitted_at from private.preview_fixture_edges e join private.preview_market_sessions s on s.id=e.session_id where e.profile_id=${profile} order by e.submitted_at desc,e.id desc limit 20`;
      return {
        status: "READY",
        label: previewPriceLabel,
        message:
          "Fictional prices for preview testing only. Real providers remain NOT_CONFIGURED; no real ranking or performance is created.",
        options: [...previewFixtureOptions],
        records: rows.map((row) => ({
          id: String(row.edge_id),
          submittedAt: iso(row.submitted_at),
          review: restoreReview(row),
          label: previewPriceLabel,
          status: "PREVIEW_ONLY",
        })),
      };
    },
  );
}
export async function reviewPreviewEdge(input: unknown) {
  const parsed = previewReviewInput.parse(input);
  return withPreviewTesterCapability(
    "preview_market_fixtures",
    async (tx, who) => {
      const profile = await actorProfile(tx, who.user.id);
      const [clock] = await tx`select clock_timestamp() as at`;
      const built = buildPreviewFixture(parsed, randomUUID(), iso(clock.at));
      await tx`insert into private.preview_market_sessions(id,profile_id,fixture_id,selection,observed_at,expires_at,payload,payload_hash)
      values(${built.review.id},${profile},${parsed.fixtureId},${parsed.selection},${built.review.observedAt},${built.review.expiresAt},${tx.json(built.payload)},${built.review.reviewToken})`;
      return built.review;
    },
  );
}
export async function submitPreviewEdge(input: unknown) {
  const parsed = previewSubmitInput.parse(input);
  return withPreviewTesterCapability(
    "preview_market_fixtures",
    async (tx, who) => {
      const profile = await actorProfile(tx, who.user.id);
      await tx`select pg_advisory_xact_lock(hashtextextended(${`preview-edge:${profile}`},0))`;
      const prior =
        await tx`select id,session_id,payload_hash,submitted_at from private.preview_fixture_edges where profile_id=${profile} and (idempotency_key=${parsed.idempotencyKey} or session_id=${parsed.reviewId})`;
      await tx`select private.assert_preview_tester_capability(${who.user.id},'preview_market_fixtures')`;
      if (prior.length) {
        if (
          prior.length !== 1 ||
          prior[0].session_id !== parsed.reviewId ||
          prior[0].payload_hash !== parsed.reviewToken
        )
          throw new Error("Preview idempotency conflict");
        return {
          id: String(prior[0].id),
          submittedAt: iso(prior[0].submitted_at),
          created: false,
          label: previewPriceLabel,
        };
      }
      const [row] =
        await tx`select * from private.preview_market_sessions where id=${parsed.reviewId} and profile_id=${profile} for update`;
      if (!row) throw new Error("Own preview review required");
      const review = restoreReview(row);
      if (review.reviewToken !== parsed.reviewToken)
        throw new Error("Preview price changed; review again");
      await tx`select private.assert_preview_tester_capability(${who.user.id},'preview_market_fixtures')`;
      const [clock] = await tx`select clock_timestamp() at`;
      assertPreviewReviewFresh(review, new Date(clock.at).getTime());
      const [edge] =
        await tx`insert into private.preview_fixture_edges(profile_id,session_id,idempotency_key,payload_hash) values(${profile},${review.id},${parsed.idempotencyKey},${parsed.reviewToken}) returning id,submitted_at`;
      return {
        id: String(edge.id),
        submittedAt: iso(edge.submitted_at),
        created: true,
        label: previewPriceLabel,
      };
    },
  );
}
