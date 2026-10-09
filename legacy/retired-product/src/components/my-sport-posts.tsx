import Link from "next/link";
import type { CommunityFeed } from "@/core/community-social";
import { SportChips } from "./community-basics";
import { FeedContent } from "./community-feed";

/** The server supplies only the signed-in member's visible posts. */
export function MySportPosts({
  feed,
  sport,
}: {
  feed: CommunityFeed;
  sport?: string;
}) {
  return (
    <section className="member-section" aria-labelledby="my-sport-posts">
      <h2 id="my-sport-posts">Your conversations</h2>
      <SportChips base="/my-edge" selected={sport} />
      <p className="small-note">
        Your posts by sport. Discussions are separate from verified Edge
        results.
      </p>
      {sport === "nfl" && (
        <p>
          <Link href="/sports/nfl">Explore NFL teams and coverage</Link>
        </p>
      )}
      <FeedContent feed={feed} base="/my-edge" tab="latest" sport={sport} />
    </section>
  );
}
