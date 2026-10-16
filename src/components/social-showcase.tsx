import Link from "next/link";
import type { AwardedCard } from "@/core/pack-opening";
import type { SocialProfile } from "@/core/community-social";
import type { SocialHub } from "@/server/social-hub";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { BrandLogo } from "./brand-logo";
import { MemberAvatar } from "./member-avatar";
import { ProfileActions } from "./social-interactions";

export function SocialShowcase({ cards }: { cards: AwardedCard[] }) {
  const selected = [
    ...new Map(cards.map((card) => [card.player_id, card])).values(),
  ].slice(0, 4);
  return (
    <div
      className="social-card-stage"
      aria-label={selected.length ? "From your collection" : "Docked community"}
    >
      {selected.length ? (
        selected.map((card) => (
          <Link
            key={card.id}
            href={`/fantasy/cards?card=${encodeURIComponent(card.id)}`}
            aria-label={`View ${card.name} in your collection`}
          >
            <FantasyCardArtwork card={card} faceOnly />
          </Link>
        ))
      ) : (
        <div className="social-stage-brand">
          <BrandLogo surface="dark" />
          <span>Collect. Build. Compete.</span>
        </div>
      )}
    </div>
  );
}

export function SocialRail({
  hub,
  profiles,
}: {
  hub: SocialHub | null;
  profiles: SocialProfile[];
}) {
  return (
    <>
      <section className="app-panel social-suggestions">
        <div className="section-row">
          <h2>Suggested to follow</h2>
          <Link href="/fantasy/social?tab=discover">See all →</Link>
        </div>
        {profiles
          .filter((p) => !p.isOwn && !p.isFollowing)
          .slice(0, 3)
          .map((p) => (
            <div className="social-suggestion" key={p.id}>
              <MemberAvatar profile={p} size={36} />
              <div>
                <Link href={`/profile/${p.handle}`}>{p.displayName}</Link>
                <small>{p.followers} followers</small>
              </div>
              <ProfileActions profile={p} />
            </div>
          ))}
        {!profiles.some((p) => !p.isOwn && !p.isFollowing) && (
          <p>Find your next conversation in Discover.</p>
        )}
      </section>
      <section className="app-panel">
        <div className="section-row">
          <h2>Your collection</h2>
          <Link href="/fantasy/cards">View →</Link>
        </div>
        {hub ? (
          <>
            <p>
              {hub.cards.length} cards ·{" "}
              {hub.visibility === "private"
                ? "Private collection"
                : `${hub.visibility === "followers" ? "Followers" : "Members"} can browse`}
            </p>
            <div className="social-mini-collection">
              {hub.cards.slice(0, 2).map(({ card }) => (
                <Link
                  href={`/fantasy/cards?card=${encodeURIComponent(card.id)}`}
                  key={card.id}
                  aria-label={`View ${card.name}`}
                >
                  <FantasyCardArtwork card={card} faceOnly />
                </Link>
              ))}
            </div>
            {!hub.cards.length && (
              <Link href="/fantasy/test-wallet?view=packs#packs">
                Explore packs →
              </Link>
            )}
          </>
        ) : (
          <p>Collection information is unavailable.</p>
        )}
        <Link href="/profile">Manage collection visibility →</Link>
      </section>
      <section className="app-panel">
        <div className="section-row">
          <h2>Communities</h2>
          <Link href="/fantasy/social?tab=communities">See all →</Link>
        </div>
        {hub?.communities.slice(0, 3).map((c) => (
          <Link
            className="social-community-link"
            key={String(c.id)}
            href={`/fantasy/social?community=${encodeURIComponent(String(c.id))}`}
          >
            <span className="social-community-mark" aria-hidden="true">
              {String(c.name).slice(0, 1)}
            </span>
            <span>
              {String(c.name)}
              <small>
                {Number(c.members)} members{c.joined ? " · Joined" : ""}
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
        {!hub?.communities.length && (
          <p>Explore available communities and join the conversation.</p>
        )}
      </section>
      <section className="app-panel">
        <h2>Trading & offers</h2>
        <p>
          {hub?.offersLive
            ? "View your private card offers."
            : "Preview only · card settlement is disabled."}
        </p>
        <Link href="/profile?tab=offers">View offers →</Link>
      </section>
    </>
  );
}
