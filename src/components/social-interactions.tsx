"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  SocialPost,
  SocialProfile,
  SocialComment,
  SocialMedia,
} from "@/core/community-social";
import { AppIcon } from "./app-icon";
import { OfficialBadge } from "./community-basics";
import { LocalTimestamp } from "./local-timestamp";
import { BrandLogo } from "./brand-logo";
export async function communityAction(
  body: Record<string, unknown>,
  endpoint = "/api/community",
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error ?? result.message ?? "This action was not confirmed.",
    );
  return result;
}
export function ProfileActions({ profile }: { profile: SocialProfile }) {
  // Refresh confirmed client state when a server refresh changes this relationship.
  // This also keeps repeated controls for one member consistent after an update.
  return (
    <ProfileActionControls
      key={`${profile.id}:${profile.isFollowing}:${profile.followNotifications ?? false}`}
      profile={profile}
    />
  );
}
function ProfileActionControls({ profile }: { profile: SocialProfile }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [following, setFollowing] = useState(profile.isFollowing),
    [notify, setNotify] = useState(profile.followNotifications ?? false);
  async function act(
    action: string,
    enabled: boolean,
    notifications?: boolean,
  ) {
    setBusy(true);
    try {
      await communityAction({
        action,
        profileId: profile.id,
        enabled,
        ...(notifications === undefined ? {} : { notifications }),
      });
      if (action === "follow") {
        setFollowing(enabled);
        if (!enabled) setNotify(false);
        else if (notifications !== undefined) setNotify(notifications);
      }
      setMessage("Preference saved.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to confirm action.");
    } finally {
      setBusy(false);
    }
  }
  if (profile.isOwn)
    return (
      <Link className="button ghost" href="/profile#edit">
        Edit profile
      </Link>
    );
  return (
    <div>
      <div className="actions">
        <button
          className="button small"
          disabled={busy}
          onClick={() => act("follow", !following)}
        >
          {following ? "Unfollow" : "Follow"}
        </button>
        <details>
          <summary>Member controls</summary>
          <div className="social-menu">
            <button
              disabled={busy}
              onClick={() => act("mute", !profile.isMuted)}
            >
              {profile.isMuted ? "Unmute" : "Mute"}
            </button>
            <button
              disabled={busy}
              onClick={() => act("block", !profile.isBlocked)}
            >
              {profile.isBlocked ? "Unblock" : "Block"}
            </button>
            <ReportForm profileId={profile.id} />
          </div>
        </details>
      </div>
      {following && !profile.isBlocked && (
        <label className="check small-note">
          <input
            type="checkbox"
            checked={notify}
            disabled={busy}
            onChange={(e) => act("follow", true, e.target.checked)}
          />
          <span>
            Notify me about this member in the app. Followed-member
            notifications must also be enabled in my preferences.
          </span>
        </label>
      )}
      <p role="status" className="form-help">
        {message}
      </p>
    </div>
  );
}
export function ReportForm({
  postId,
  profileId,
  commentId,
}: {
  postId?: string;
  profileId?: string;
  commentId?: string;
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await communityAction({
        action: "report",
        postId,
        profileId,
        commentId,
        reason: form.get("reason"),
        details: form.get("details"),
      });
      setMessage(
        "Report submitted for review. Reporting cannot erase a permanent Edge.",
      );
      setOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Report not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}>
        Report
      </button>
      {open && (
        <form className="app-form" method="post" onSubmit={report}>
          <label>
            Reason
            <select name="reason" required>
              {[
                "spam",
                "harassment",
                "impersonation",
                "privacy",
                "scam",
                "affiliate_spam",
                "misleading_odds",
                "other",
              ].map((r) => (
                <option key={r} value={r}>
                  {r.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Details
            <textarea name="details" required minLength={10} maxLength={1000} />
          </label>
          <button className="button" disabled={busy}>
            Send report
          </button>
        </form>
      )}
      <p role="status" className="form-help">
        {message}
      </p>
    </div>
  );
}
function CommentForm({
  postId,
  parentId,
}: {
  postId: string;
  parentId?: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const router = useRouter();
  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await communityAction({
        action: "comment",
        postId,
        parentId,
        body,
        idempotencyKey: key,
      });
      setBody("");
      setKey(crypto.randomUUID());
      setMessage("Comment posted.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Comment not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="app-form" method="post" onSubmit={send}>
      <label>
        {parentId ? "Reply" : "Add a comment"}
        <textarea
          required
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <button className="button small" disabled={busy || !body.trim()}>
        {parentId ? "Post reply" : "Post comment"}
      </button>
      <p role="status" className="form-help">
        {message}
      </p>
    </form>
  );
}
function Comment({ comment }: { comment: SocialComment }) {
  const [reply, setReply] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function remove() {
    try {
      await communityAction({
        action: "delete_comment",
        commentId: comment.id,
      });
      setMessage("Comment deleted. The underlying Edge is unchanged.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Deletion not confirmed.");
    }
  }
  return (
    <div className="social-comment">
      <Link href={`/profile/${comment.author.handle}`}>
        <strong>@{comment.author.handle}</strong>
      </Link>
      <p>
        {comment.moderationStatus === "removed"
          ? "COMMENTARY REMOVED BY MODERATION"
          : comment.body}
      </p>
      <LocalTimestamp value={comment.createdAt} />
      <div className="actions">
        {!comment.parentId && comment.moderationStatus === "visible" && (
          <button onClick={() => setReply(!reply)}>Reply</button>
        )}
        <ReportForm commentId={comment.id} />
        {comment.author.isOwn && (
          <button onClick={remove}>Delete comment</button>
        )}
      </div>
      <p role="status" className="form-help">
        {message}
      </p>
      {reply && <CommentForm postId={comment.postId} parentId={comment.id} />}
    </div>
  );
}
export function SocialCard({ post }: { post: SocialPost }) {
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [showComments, setShowComments] = useState(false);
  async function action(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await communityAction({ action, postId: post.id, ...extra });
      setMessage("Saved.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = `${window.location.origin}/community/posts/${post.id}`;
    try {
      if (navigator.share)
        await navigator.share({ title: "Docked community discussion", url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied.");
      }
    } catch {
      setMessage("Sharing was cancelled or unavailable.");
    }
  }
  return (
    <article className="social-card">
      <div className="social-author">
        <span className="avatar" aria-hidden="true">
          {post.author.isOfficial ? (
            <BrandLogo variant="mark" className="brand-avatar" decorative />
          ) : (
            post.author.displayName.slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <Link
            href={`/profile/${post.author.handle}`}
            className="social-author-name"
          >
            {post.author.displayName}
          </Link>
          <span className="social-author-meta">
            @{post.author.handle} · {post.kind}
          </span>
        </div>
        {post.author.isOfficial && <OfficialBadge />}
      </div>
      <LocalTimestamp value={post.createdAt} />
      {post.claimLabel === "promotional_price" && (
        <p className="promotion-label">
          PROMOTIONAL PRICE — NOT LEADERBOARD ELIGIBLE
        </p>
      )}
      <p className="social-body">
        {post.moderationStatus === "removed"
          ? "COMMENTARY REMOVED BY MODERATION"
          : post.body}
      </p>
      {post.officialTipId && (
        <div className="app-state-banner">
          <OfficialBadge />
          <p>This discussion refers to the canonical official record.</p>
          <Link className="text-link" href={`/tips/${post.officialTipId}`}>
            Official Edge and complete evidence
          </Link>
        </div>
      )}
      {post.communityEdgeId && (
        <div className="app-state-banner">
          <span className="community-badge">PERMANENT COMMUNITY EDGE</span>
          <p>Structured fields and all outcomes remain in the ledger.</p>
          <Link
            className="text-link"
            href={`/community/edges/${post.communityEdgeId}`}
          >
            View verified record
          </Link>
        </div>
      )}
      {post.moderationStatus === "visible" &&
        post.media
          .filter((m) => m.status === "approved" && m.url)
          .map((m) => (
            <img
              key={m.id}
              className="social-photo"
              src={m.url!}
              width={m.width}
              height={m.height}
              alt={m.alt}
              loading="lazy"
            />
          ))}
      {!post.communityEdgeId && !post.officialTipId && (
        <p className="social-reason">
          SOCIAL ONLY · Not a verified performance record
        </p>
      )}
      <div className="social-actions">
        <button
          disabled={busy}
          aria-pressed={post.isReacted}
          onClick={() => action("react", { enabled: !post.isReacted })}
        >
          <AppIcon name="heart" size={18} />
          {post.reactionCount} reactions
        </button>
        <button
          aria-expanded={showComments}
          onClick={() => setShowComments(!showComments)}
        >
          <AppIcon name="comment" size={18} />
          {post.commentCount} comments
        </button>
        <button
          disabled={busy}
          aria-pressed={post.isSaved}
          onClick={() => action("save", { enabled: !post.isSaved })}
        >
          <AppIcon name="save" size={18} />
          {post.isSaved ? "Saved" : "Save"}
        </button>
        <button onClick={share}>
          <AppIcon name="share" size={18} />
          Share
        </button>
        <details>
          <summary>More</summary>
          <div className="social-menu">
            <ReportForm postId={post.id} />
            {post.author.isOwn && (
              <button disabled={busy} onClick={() => action("delete_post")}>
                Delete social commentary
              </button>
            )}
            {!post.author.isOwn && <ProfileActions profile={post.author} />}
          </div>
        </details>
      </div>
      <p role="status" className="form-help">
        {message}
      </p>
      {showComments && (
        <section aria-label="Comments">
          {post.comments
            .filter((c) => !c.parentId)
            .map((c) => (
              <div key={c.id}>
                <Comment comment={c} />
                {post.comments
                  .filter((reply) => reply.parentId === c.id)
                  .map((reply) => (
                    <div className="comment-reply" key={reply.id}>
                      <Comment comment={reply} />
                    </div>
                  ))}
              </div>
            ))}
          <CommentForm postId={post.id} />
        </section>
      )}
    </article>
  );
}
export function ProfileEditor({ profile }: { profile: SocialProfile | null }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const [media, setMedia] = useState<SocialMedia[]>([]);
  async function reloadMedia() {
    try {
      const response = await fetch("/api/community?view=own_media", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) setMedia(data.media ?? []);
    } catch {
      /* Media selection stays empty on failure. */
    }
  }
  useEffect(() => {
    let live = true;
    void fetch("/api/community?view=own_media", { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => {
        if (live) setMedia(v.media ?? []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await communityAction({
        action: "profile",
        handle: d.get("handle"),
        displayName: d.get("displayName"),
        bio: d.get("bio"),
        visibility: d.get("visibility"),
        ...(d.get("avatarMediaId") !== "unchanged"
          ? { avatarMediaId: d.get("avatarMediaId") || null }
          : {}),
      });
      setMessage("Profile saved.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Profile not saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="app-panel" id="edit">
      <h2>Your community profile</h2>
      <form className="app-form" method="post" onSubmit={save}>
        <label>
          Username
          <input
            name="handle"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z][a-z0-9_]*"
            defaultValue={profile?.handle}
            autoComplete="username"
          />
          <span className="form-help">
            Lowercase letters, digits and underscores. Official handles and
            impersonation are blocked.
          </span>
        </label>
        <label>
          Display name
          <input
            name="displayName"
            required
            maxLength={60}
            defaultValue={profile?.displayName}
          />
        </label>
        <label>
          Bio
          <textarea name="bio" maxLength={280} defaultValue={profile?.bio} />
        </label>
        <label>
          Profile visibility
          <select
            name="visibility"
            defaultValue={profile?.visibility ?? "members"}
          >
            <option value="members">Approved members</option>
            <option value="private">Private</option>
          </select>
        </label>
        <p className="form-help">
          Private settings and email are never displayed. A privacy change
          cannot silently erase an underlying Edge record or selectively hide a
          loss.
        </p>
        <label>
          Avatar
          <select name="avatarMediaId" defaultValue="unchanged">
            <option value="unchanged">Keep current avatar</option>
            <option value="">Use initials</option>
            {media
              .filter((m) => m.status === "approved")
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.alt}
                </option>
              ))}
          </select>
          <span className="form-help">
            Only your approved images are available as avatars.
          </span>
        </label>
        <button className="button" disabled={busy}>
          Save profile
        </button>
        <p role="status">{message}</p>
      </form>
      <AvatarUpload onUploaded={reloadMedia} />
    </section>
  );
}
function AvatarUpload({ onUploaded }: { onUploaded: () => Promise<void> }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = new FormData(e.currentTarget);
    body.set("action", "media_upload");
    setBusy(true);
    try {
      const response = await fetch("/api/community", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Upload unavailable.");
      setMessage(
        "Avatar image is in private quarantine. Return after moderation approval to select it.",
      );
      await onUploaded();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Upload an avatar for review</summary>
      <form className="app-form" method="post" onSubmit={upload}>
        <label>
          Avatar image
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </label>
        <label>
          Image description
          <input name="alt" minLength={5} maxLength={240} required />
        </label>
        <p className="form-help">
          Static JPEG, PNG or WebP up to 4 MB. Use an image you have rights to
          share. Remove private identifiers. Review is required before public
          display.
        </p>
        <button className="button ghost" disabled={busy}>
          Upload for moderation
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
