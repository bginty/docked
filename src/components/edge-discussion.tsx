import { communityFeed } from "@/server/community-social";
import { SocialCard } from "./social-interactions";
export async function EdgeDiscussion({
  officialTipId,
  communityEdgeId,
}: {
  officialTipId?: string;
  communityEdgeId?: string;
}) {
  const thread = await communityFeed({ officialTipId, communityEdgeId });
  return (
    <section
      className="edge-discussion"
      id="discussion"
      aria-label="Edge discussion"
    >
      <h2>Discussion and reactions</h2>
      <p className="small-note">
        Commentary is separate from the locked record. Removing a post never
        removes its Edge or result.
      </p>
      {thread.posts.length ? (
        thread.posts.map((post) => <SocialCard key={post.id} post={post} />)
      ) : (
        <p>
          {thread.message ||
            "No discussion is visible under your current community permissions."}
        </p>
      )}
    </section>
  );
}
