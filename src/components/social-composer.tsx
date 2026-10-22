"use client";
import type { SocialProfile } from "@/core/community-social";
import { MemberAvatar } from "./member-avatar";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { communityAction } from "./social-interactions";
import { NativeImagePicker } from "./native-image-picker";
import { useClientReady } from "./use-client-ready";
import { useSocialHub } from "./social-hub";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { FantasySheet } from "./fantasy-player-sheet";
import { boundedFetch as communityRequest } from "@/core/bounded-request";
import { useSport } from "./sport-context";
export function SocialComposer({
  initialSport,
  inline = false,
  initialBody = "",
  memberName = "You",
  memberProfile,
  communityId,
  playerId,
  initialCardIds = [],
  onPublished,
  onCancel,
}: {
  previewFixtures?: boolean;
  initialSport?: string;
  inline?: boolean;
  initialBody?: string;
  memberName?: string;
  memberProfile?: SocialProfile | null;
  communityId?: string;
  playerId?: string;
  initialCardIds?: string[];
  onPublished?: () => void;
  onCancel?: () => void;
}) {
  const { data: hub, error: hubError, reload: reloadCards } = useSocialHub();
  const { sport: activeSport } = useSport();
  const [selectedSport, setSelectedSport] = useState(initialSport ?? "");
  const [cardIds, setCards] = useState<string[]>(() =>
    initialCardIds.slice(0, 4),
  );
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [imageUpload, setImageUpload] = useState(false);
  const [preview, setPreview] = useState(false);
  const postForm = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState(initialBody),
    [mediaIds, setMedia] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const sending = useRef(false);
  const router = useRouter();
  const ready = useClientReady();
  const attachmentSports = [
    ...new Set(
      hub?.cards
        .filter(({ card }) => cardIds.includes(card.id))
        .map(({ card }) => card.sport) ?? [],
    ),
  ];
  const attachmentSport =
    attachmentSports.length === 1 ? attachmentSports[0] : undefined;
  useEffect(() => {
    if (attachmentSport) setSelectedSport(attachmentSport);
    else if (inline && !cardIds.length) setSelectedSport(activeSport);
  }, [attachmentSport, activeSport, inline, cardIds.length]);
  useEffect(() => {
    const focus = () => {
      if (ready && inline && location.hash === "#social-compose")
        postForm.current?.querySelector("textarea")?.focus();
    };
    focus();
    window.addEventListener("hashchange", focus);
    return () => window.removeEventListener("hashchange", focus);
  }, [inline, ready]);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || busy || sending.current) return;
    const data = new FormData(e.currentTarget);
    data.set("action", "media_upload");
    sending.current = true;
    setBusy(true);
    try {
      const r = await communityRequest("/api/community", {
        method: "POST",
        body: data,
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error ?? "Upload not accepted.");
      const id = v.media?.id ?? v.id;
      if (!id) throw new Error("No upload reference received.");
      setMedia((ids) => [...ids, id]);
      setMessage("Image submitted for moderation.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload not confirmed.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function post(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || busy || sending.current) return;
    const d = new FormData(e.currentTarget);
    sending.current = true;
    setBusy(true);
    try {
      const v = await communityAction({
        action: "post",
        kind: d.get("kind"),
        body,
        sport: d.get("sport") || undefined,
        mediaIds,
        cardIds,
        communityId,
        playerId,
        promotional: false,
        idempotencyKey: key,
      });
      setBody("");
      setMedia([]);
      setCards([]);
      setKey(crypto.randomUUID());
      setMessage("Social post published.");
      setPreview(false);
      setPicker(false);
      onPublished?.();
      if (inline)
        router.push(
          `/fantasy/social?tab=latest${communityId ? `&community=${communityId}` : ""}${playerId ? `&player=${encodeURIComponent(playerId)}` : ""}`,
        );
      else if (v.post?.id ?? v.id)
        router.push(`/community/posts/${v.post?.id ?? v.id}`);
      else router.push("/community?tab=latest");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Post not confirmed.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className={`docked-composer ${inline ? "inline-composer" : ""}`}
      data-composer-ready={ready}
    >
      <fieldset className="app-panel" disabled={!ready || busy}>
        {inline ? (
          <MemberAvatar
            profile={
              memberProfile ?? {
                displayName: memberName,
                avatarUrl: null,
                isOfficial: false,
              }
            }
          />
        ) : (
          <h2>Create post</h2>
        )}
        <form ref={postForm} className="app-form" method="post" onSubmit={post}>
          <label>
            Your post
            <textarea
              required
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What’s happening in your squad?"
              rows={2}
            />
          </label>
          <details className="composer-options">
            <summary>Post options</summary>{" "}
            <div className="form-split">
              <label>
                Post type
                <select name="kind">
                  <option value="discussion">Discussion</option>
                  <option value="analysis">Analysis</option>
                  <option value="question">Question</option>
                  <option value="celebration">Celebration</option>
                </select>
              </label>
              <label>
                Sport (optional)
                <select
                  name="sport"
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value)}
                >
                  <option value="">All sports</option>
                  {[
                    "football",
                    "basketball",
                    "tennis",
                    "nfl",
                    "cricket",
                    "baseball",
                    "horse-racing",
                    "ice-hockey",
                    "motorsport",
                    "afl",
                    "nrl",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          {mediaIds.length > 0 && (
            <p>
              {mediaIds.length} image(s) awaiting moderation. They are not
              visible until approved.
            </p>
          )}
          <button
            type="button"
            className="composer-card-picker"
            onClick={() => setPicker(true)}
          >
            Attach cards {cardIds.length ? `(${cardIds.length}/4)` : ""}
          </button>
          <button
            type="button"
            className="composer-image-picker"
            onClick={() => setImageUpload(true)}
          >
            Add image
          </button>
          {cardIds.length > 0 && (
            <div
              className="social-attachment-preview"
              aria-label="Selected cards"
            >
              {hub?.cards
                .filter(({ card }) => cardIds.includes(card.id))
                .map(({ card }) => (
                  <FantasyCardArtwork key={card.id} card={card} faceOnly />
                ))}
            </div>
          )}
          {picker && (
            <FantasySheet
              title="Attach your cards"
              onClose={() => setPicker(false)}
              className="attachment-sheet"
            >
              <label>
                Search owned players
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {hubError && (
                <p role="alert">
                  {hubError}{" "}
                  <button type="button" onClick={reloadCards}>
                    Retry cards
                  </button>
                </p>
              )}
              {!hub && !hubError && <p>Loading your opened cards…</p>}
              {hub?.cards.length === 0 && <p>No opened cards available.</p>}
              <div className="social-attachment-grid">
                {hub?.cards
                  .filter(({ card }) =>
                    card.name
                      .toLowerCase()
                      .includes(search.trim().toLowerCase()),
                  )
                  .map(({ card }) => (
                    <label key={card.id}>
                      <input
                        type="checkbox"
                        checked={cardIds.includes(card.id)}
                        disabled={
                          !cardIds.includes(card.id) && cardIds.length >= 4
                        }
                        onChange={(e) =>
                          setCards(
                            e.target.checked
                              ? [...cardIds, card.id]
                              : cardIds.filter((id) => id !== card.id),
                          )
                        }
                      />
                      <FantasyCardArtwork card={card} faceOnly />
                    </label>
                  ))}
              </div>
              <button
                type="button"
                className="button"
                onClick={() => setPicker(false)}
              >
                Done · {cardIds.length} selected
              </button>
            </FantasySheet>
          )}
          <div className="composer-submit actions">
            <button
              type="submit"
              className="button"
              disabled={busy || !body.trim()}
            >
              {busy ? "Posting…" : "Post"}
            </button>
            <button
              type="button"
              className="button composer-preview-button"
              disabled={busy || !body.trim()}
              onClick={() => {
                setMessage("");
                setPreview(true);
              }}
            >
              Preview post
            </button>
            {(body || cardIds.length > 0 || mediaIds.length > 0) && (
              <button
                type="button"
                className="button ghost"
                disabled={busy}
                onClick={() => {
                  setBody("");
                  setMedia([]);
                  setCards([]);
                  setKey(crypto.randomUUID());
                  setMessage("Draft cleared.");
                  setPicker(false);
                  setPreview(false);
                  onCancel?.();
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        {imageUpload && (
          <FantasySheet title="Add image" onClose={() => setImageUpload(false)}>
            <form className="app-form" method="post" onSubmit={upload}>
              <NativeImagePicker />
              <label>
                Image
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                />
              </label>
              <label>
                Image description
                <input name="alt" required minLength={5} maxLength={240} />
              </label>
              <p className="form-help">
                Uploads are reviewed before display. Remove personal information
                before uploading.
              </p>
              <button
                className="button ghost"
                disabled={busy || mediaIds.length >= 4}
              >
                Upload for review
              </button>
            </form>
          </FantasySheet>
        )}
        <p role="status" className="form-message">
          {message}
        </p>
      </fieldset>
      {preview && (
        <FantasySheet
          title="Preview post"
          onClose={() => setPreview(false)}
          className="post-preview-sheet"
        >
          <p className="social-body">{body}</p>
          <div className="social-attachment-preview">
            {hub?.cards
              .filter(({ card }) => cardIds.includes(card.id))
              .map(({ card }) => (
                <FantasyCardArtwork key={card.id} card={card} faceOnly />
              ))}
          </div>
          {!!mediaIds.length && (
            <p>{mediaIds.length} image(s) awaiting moderation.</p>
          )}
          <p role="status">{message}</p>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPreview(false)}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => postForm.current?.requestSubmit()}
            >
              {busy ? "Publishing…" : "Post"}
            </button>
          </div>
        </FantasySheet>
      )}
    </div>
  );
}
