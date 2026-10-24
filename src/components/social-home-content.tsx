"use client";
import Link from "next/link";
import { NavigationShortcut } from "./navigation-shortcut";
import { useSport } from "./sport-context";
import type { CommunityFeed } from "@/core/community-social";
import { SocialComposer } from "./social-composer";
import { SocialTimeline } from "./social-timeline";
import { CommunityDirectory } from "./social-hub";
import { SocialDiscovery } from "./social-discovery";
import type { PublishedAnnouncement } from "@/server/member-announcements";
import { OfficialAnnouncement } from "./official-announcement";
import { MemberAvatar } from "./member-avatar";
import { ProfileActions } from "./social-interactions";

export function SocialHomeContent({
  feed,
  tab,
  view,
  communityId,
  playerId,
  announcements,
  sport = "nfl",
}: {
  announcements: PublishedAnnouncement[] | null;
  feed: CommunityFeed;
  tab: "latest" | "following" | "for_you";
  view?: string;
  communityId?: string;
  playerId?: string;
  sport?: string;
}) {
  const { sport: activeSport } = useSport();
  const href = (tab: string) => `/fantasy/social?sport=${sport}&tab=${tab}`;
  const pinned = announcements?.find((a) => a.pinned);
  const selected = view ?? (tab === "for_you" ? "latest" : tab);
  const composeHref = `${href("latest")}#social-compose`;
  if (activeSport !== sport)
    return <p role="status">Loading {activeSport.toUpperCase()} community…</p>;
  return (
    <section className="premium-social compact-social">
      <header className="social-page-heading">
        <div>
          <h1>Community</h1>
          <p>Talk cards. Build your squad.</p>
        </div>
        <div className="actions">
          <Link className="pack-control secondary" href={href("communities")}>
            Communities
          </Link>
          <Link className="pack-control secondary" href={href("discover")}>
            Find people
          </Link>
        </div>
      </header>
      {pinned && selected !== "announcements" && (
        <OfficialAnnouncement item={pinned} compact />
      )}
      <nav className="community-tabs" aria-label="Social sections">
        {[
          ["latest", "Latest"],
          ["following", "Following"],
          ["announcements", "Announcements"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={href(key)}
            aria-current={selected === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="social-home-grid">
        <div>
          {selected === "announcements" ? (
            <section aria-label="Official announcements">
              {announcements === null ? (
                <p role="alert">
                  Announcements could not be loaded.{" "}
                  <Link href={href("announcements")}>Retry</Link>
                </p>
              ) : announcements.length ? (
                announcements.map((item) => (
                  <OfficialAnnouncement key={item.id} item={item} archive />
                ))
              ) : (
                <p>No official announcements yet.</p>
              )}
              <NavigationShortcut
                compact
                icon="bell"
                href={`/fantasy/announcements?sport=${sport}`}
              >
                All announcements
              </NavigationShortcut>
            </section>
          ) : selected === "discover" || selected === "communities" ? (
            <>
              <Link className="pack-control primary" href={composeHref}>
                Start a conversation
              </Link>
              {selected === "discover" ? (
                <SocialDiscovery suggestions={feed.profiles} />
              ) : (
                <CommunityDirectory />
              )}
            </>
          ) : (
            <>
              {(communityId || playerId) && (
                <div className="section-row">
                  <h2>
                    {communityId ? "Community feed" : "Player discussion"}
                  </h2>
                  <Link href={href("latest")}>All posts</Link>
                </div>
              )}
              <div id="social-compose" tabIndex={-1}>
                <SocialComposer
                  key={sport}
                  initialSport={sport}
                  inline
                  memberName={feed.viewer?.displayName}
                  memberProfile={feed.viewer}
                  communityId={communityId}
                  playerId={playerId}
                />
              </div>
              <SocialTimeline
                sport={sport}
                feed={feed}
                base="/fantasy/social"
                tab={tab === "for_you" ? "latest" : tab}
                communityId={communityId}
                playerId={playerId}
              />
            </>
          )}
        </div>
        <aside>
          <section className="app-panel social-suggestions">
            <h2>People to follow</h2>
            {feed.profiles
              .filter((p) => !p.isOwn && !p.isFollowing)
              .slice(0, 3)
              .map((p) => (
                <div className="social-suggestion" key={p.id}>
                  <MemberAvatar profile={p} size={36} />
                  <Link href={`/profile/${p.handle}`}>
                    {p.displayName}
                    <small>@{p.handle}</small>
                  </Link>
                  <ProfileActions profile={p} />
                </div>
              ))}
            <Link href={href("discover")}>Find people</Link>
          </section>
          <section className="app-panel social-secondary-links">
            <NavigationShortcut compact icon="shield" href="/beta-policies">
              Community guidelines
            </NavigationShortcut>
            <NavigationShortcut compact icon="profile" href="/dashboard">
              Account help
            </NavigationShortcut>
            {feed.viewer && (
              <Link href={`/profile/${feed.viewer.handle}?tab=activity`}>
                My activity
              </Link>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
