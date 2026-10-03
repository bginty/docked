"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CommunityFeed } from "@/core/community-social";
import { SocialCard } from "./social-interactions";
import { CommunityEmpty } from "./community-basics";

type TimelineProps = {
  feed: CommunityFeed;
  base: string;
  tab: "for_you" | "following" | "latest";
  sport?: string;
};
const pageLimit = 20;
const retainedLimit = 100;

export function SocialTimeline(props: TimelineProps) {
  // Exact server projection identity: a refreshed permission, moderation, counter
  // or member change discards all appended rows. Never persist this private data.
  return (
    <TimelinePage
      key={JSON.stringify([props.tab, props.sport ?? null, props.feed])}
      {...props}
    />
  );
}

function TimelinePage({ feed, base, tab, sport }: TimelineProps) {
  const router = useRouter();
  const [posts, setPosts] = useState(feed.status === "ready" ? feed.posts : []);
  const [cursor, setCursor] = useState(
    feed.status === "ready" ? feed.nextCursor : null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(feed.status !== "ready");
  const request = useRef<AbortController | null>(null);
  const loading = useRef(false);
  useEffect(() => {
    const refresh = () => {
      void loadPage(null, true);
    };
    window.addEventListener("docked:community-updated", refresh);
    return () => {
      request.current?.abort();
      window.removeEventListener("docked:community-updated", refresh);
    };
    // The parent key remounts this component for every meaningful input change.
    // Identical refreshed props must not abort an in-flight request and leave it busy.
  }, []);

  function unavailable(reason: string) {
    setPosts([]);
    setCursor(null);
    setBlocked(true);
    setMessage(reason);
    router.refresh();
  }

  async function loadPage(pageCursor: string | null, reset = false) {
    if (
      !reset &&
      (loading.current ||
        !pageCursor ||
        blocked ||
        posts.length > retainedLimit - pageLimit)
    )
      return;
    if (reset) {
      request.current?.abort();
      setPosts([]);
      setCursor(null);
      setBlocked(true);
    }
    loading.current = true;
    setBusy(true);
    setMessage(reset ? "Refreshing the feed after your change…" : "");
    const controller = new AbortController();
    request.current = controller;
    try {
      const params = new URLSearchParams({
        view: "feed",
        tab,
        ...(pageCursor ? { cursor: pageCursor } : {}),
        ...(sport ? { sport } : {}),
      });
      const response = await fetch(`/api/community?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        unavailable(
          "Feed access could not be confirmed. Previously loaded posts have been cleared.",
        );
        return;
      }
      const page = (await response.json()) as CommunityFeed;
      if (controller.signal.aborted) return;
      if (
        page.status !== "ready" ||
        !Array.isArray(page.posts) ||
        page.posts.length > pageLimit ||
        (page.viewer?.id ?? null) !== (feed.viewer?.id ?? null)
      ) {
        unavailable(
          "This feed is unavailable under your current account and permissions. Previously loaded posts have been cleared.",
        );
        return;
      }
      if (
        page.posts.some((post) => typeof post.id !== "string" || !post.id) ||
        (page.nextCursor !== null &&
          (typeof page.nextCursor !== "string" ||
            page.nextCursor === pageCursor))
      ) {
        unavailable(
          "Feed pagination could not be verified. Refresh before continuing.",
        );
        return;
      }
      setPosts((previous) => {
        if (reset) return page.posts;
        const unique = new Map(previous.map((post) => [post.id, post]));
        for (const post of page.posts) unique.set(post.id, post);
        // Reserve room for a complete server page before fetching it. Truncating
        // here would skip records when advancing to that page's ending cursor.
        return [...unique.values()];
      });
      setCursor(page.nextCursor);
      setBlocked(false);
      setMessage(
        reset
          ? "Feed refreshed."
          : page.posts.length
            ? "Older posts loaded."
            : "No more visible posts in this page.",
      );
    } catch {
      if (!controller.signal.aborted)
        unavailable(
          "The feed could not be refreshed. Previously loaded posts have been cleared; try again when connected.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        loading.current = false;
        request.current = null;
      }
    }
  }

  const safeBase = ["/feed", "/following", "/home", "/community"].includes(base)
    ? base
    : "/feed";
  return (
    <>
      {posts.length ? (
        <div className="app-feed social-timeline" aria-busy={busy}>
          {posts.map((post) => (
            <SocialCard key={post.id} post={post} compact />
          ))}
        </div>
      ) : (
        <CommunityEmpty
          title={
            blocked ? "Community feed unavailable" : "A little quieter here."
          }
        >
          {blocked
            ? message ||
              feed.message ||
              "Current permissions could not be confirmed."
            : "No visible posts match this view. Follow a perspective or start a conversation; no activity is invented."}
        </CommunityEmpty>
      )}
      {cursor && !blocked && posts.length <= retainedLimit - pageLimit && (
        <button
          className="button ghost feed-load-more"
          type="button"
          onClick={() => loadPage(cursor)}
          disabled={busy}
        >
          {busy ? "Loading older posts…" : "Load more posts"}
        </button>
      )}
      {cursor && !blocked && posts.length > retainedLimit - pageLimit && (
        <Link
          className="button ghost feed-load-more"
          href={`${safeBase}?${new URLSearchParams({ tab, cursor, ...(sport ? { sport } : {}) })}`}
        >
          Continue with older posts
        </Link>
      )}
      {blocked && (
        <button
          className="button ghost"
          type="button"
          disabled={busy}
          onClick={() => loadPage(null, true)}
        >
          Refresh feed
        </button>
      )}
      <p role="status" className="form-help">
        {message}
      </p>
    </>
  );
}
