import { SocialComposer } from "../../src/components/social-composer";
import {
  SocialCard,
  ProfileActions,
} from "../../src/components/social-interactions";
import type {
  SocialProfile,
  SocialPost,
} from "../../src/core/community-social";
const profile: SocialProfile = {
  id: "d0000000-0000-4000-8000-000000000001",
  handle: "demo_hydration",
  displayName: "DEMO hydration fixture",
  bio: "Local-only; no account.",
  avatarUrl: null,
  isOfficial: false,
  visibility: "members",
  status: "active",
  joinedAt: "2026-10-03T00:00:00Z",
  followers: 0,
  following: 0,
  isFollowing: false,
  isMuted: false,
  isBlocked: false,
  isOwn: false,
};
const post: SocialPost = {
  id: "d0000000-0000-4000-8000-000000000002",
  author: profile,
  kind: "discussion",
  body: "DEMO local-only test; no genuine activity or performance.",
  sport: null,
  createdAt: "2026-10-03T00:00:00Z",
  moderationStatus: "visible",
  claimLabel: "social_only",
  officialTipId: null,
  communityEdgeId: null,
  media: [],
  reactionCount: 0,
  commentCount: 0,
  isReacted: false,
  isSaved: false,
  comments: [],
};
export function HydrationView() {
  return (
    <>
      <SocialComposer previewFixtures />
      <section id="social-fixture">
        <SocialCard post={post} />
      </section>
      <section id="profile-fixture">
        <ProfileActions profile={profile} />
      </section>
    </>
  );
}
