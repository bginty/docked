// Production screen components with isolated, non-persistent card snapshots.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { state, cards } from "./play-standings-visual";
import { futuristicCard } from "./futuristic-data";
import { FantasyScreen } from "../../src/components/fantasy-screen";
import { FantasyCardArtwork } from "../../src/components/fantasy-card-artwork";
import { Marketplace } from "../../src/components/marketplace";
import { SocialCard } from "../../src/components/social-interactions";
import { ProfileCollection } from "../../src/components/social-hub";
import { SocialComposer } from "../../src/components/social-composer";
import { AppShell } from "../../src/components/app-shell";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { SportProvider } from "../../src/components/sport-context";
import PackOpening from "../../src/components/pack-opening";
import { RarityGallery } from "./rarity-gallery";
import type { SocialPost } from "../../src/core/community-social";
Object.assign(cards[5], futuristicCard);
state.cards = cards;
state.seven!.inventory = cards;
const original = window.fetch;
window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    location.origin,
  );
  if (
    url.pathname === "/api/community" &&
    url.searchParams.get("view") === "hub"
  )
    return Response.json({
      own: false,
      viewer: "visual-viewer",
      handle: "local-member",
      visibility: "members",
      visible: true,
      cards: [{ card: futuristicCard, offers: false, asking: null }],
      settings: null,
      communities: [],
      canManage: false,
      offersLive: false,
      teams: [],
      teamsMessage: "Fantasy teams remain private.",
    });
  if (
    url.pathname === "/api/community" &&
    url.searchParams.get("view") === "own_cards"
  )
    return Response.json({ cards: [futuristicCard] });
  return original(input, init);
};
const post: SocialPost = {
  id: "local-card-post",
  kind: "discussion",
  body: "My collection highlight. Local visual fixture only.",
  sport: "nfl",
  createdAt: "2026-10-16T00:00:00Z",
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
  cardSnapshots: [futuristicCard],
  author: {
    id: "local-member",
    handle: "local-member",
    displayName: "Local collector",
    bio: "",
    avatarUrl: null,
    isOfficial: false,
    visibility: "members",
    status: "active",
    joinedAt: "2026-10-01T00:00:00Z",
    followers: 0,
    following: 0,
    isFollowing: false,
    isMuted: false,
    isBlocked: false,
    isOwn: true,
  },
};
const previewView =
  new URLSearchParams(location.search).get("context") ?? "collection";
history.replaceState(null, "", location.pathname);
function Preview() {
  const [reveal, setReveal] = useState(false);
  const view = previewView;
  return (
    <EnvironmentProvider
      value={{
        production: true,
        liveBeta: true,
        registrationAvailable: false,
        emailAvailable: false,
        invitationAllowed: false,
        policyVersions: null,
        accountConfigured: true,
        reason: "",
      }}
    >
      <SportProvider>
        <AppShell authenticated>
          <p className="small-note">
            LOCAL VISUAL FIXTURE · Synthetic number metadata · no member assets
            changed
          </p>
          <nav className="actions">
            {[
              "collection",
              "market",
              "social",
              "member",
              "reveal",
              "lineup",
              "rarities",
            ].map((v) => (
              <a key={v} href={`?futuristic=1&context=${v}`}>
                {v}
              </a>
            ))}
          </nav>
          {view === "rarities" ? (
            <RarityGallery base={futuristicCard} />
          ) : view === "market" ? (
            <Marketplace member="visual-member" />
          ) : view === "social" ? (
            <div className="premium-social">
              <SocialComposer initialSport="nfl" inline />
              <SocialCard post={post} />
            </div>
          ) : view === "member" ? (
            <>
              <h1>Local collector</h1>
              <ProfileCollection handle="local-member" />
            </>
          ) : view === "reveal" ? (
            <>
              <h1>Saved pack reveal</h1>
              <button onClick={() => setReveal(true)}>
                Replay saved result
              </button>
              <div style={{ width: 240 }}>
                <FantasyCardArtwork card={futuristicCard} faceOnly />
              </div>
            </>
          ) : (
            <FantasyScreen
              tab={view === "lineup" ? "play" : "cards"}
              initial={state}
              packExperience
            />
          )}
          {reveal && (
            <PackOpening
              name="Local saved result"
              userId="visual-member"
              receipt={{
                id: "futuristic-saved-receipt",
                name: "Local saved result",
                opened_at: "2026-10-16T00:00:00Z",
                cards: [futuristicCard],
              }}
              openPack={async () => {
                throw Error("No issuance in visual fixture");
              }}
              ownedIds={[futuristicCard.id]}
              onClose={() => setReveal(false)}
              onViewCard={() => {}}
              preview
              replay
            />
          )}
        </AppShell>
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Preview />);
