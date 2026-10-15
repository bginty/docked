"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { communityAction } from "./social-interactions";
import { NativeImagePicker } from "./native-image-picker";
import { useClientReady } from "./use-client-ready";
import { useSocialHub } from "./social-hub";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
export function SocialComposer({
  initialSport,
  inline = false,
  initialBody = "",
  memberName = "You",
  communityId,
  playerId,
}: {
  previewFixtures?: boolean;
  initialSport?: string;
  inline?: boolean;
  initialBody?: string;
  memberName?: string;
  communityId?: string;
  playerId?: string;
}) {
  const { data: hub, error: hubError } = useSocialHub();
  const [cardIds, setCards] = useState<string[]>([]);
  const [body, setBody] = useState(initialBody),
    [mediaIds, setMedia] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const sending = useRef(false);
  const router = useRouter();
  const ready = useClientReady();
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || busy || sending.current) return;
    const data = new FormData(e.currentTarget);
    data.set("action", "media_upload");
    sending.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/community", { method: "POST", body: data });
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
          <span className="composer-avatar" aria-hidden="true">
            {memberName.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <h2>Create post</h2>
        )}
        <form className="app-form" method="post" onSubmit={post}>
          <label>
            Your post
            <textarea
              required
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What’s happening?"
              rows={3}
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
                <select name="sport" defaultValue={initialSport ?? ""}>
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
          <details className="composer-card-picker">
            <summary>
              Attach your cards {cardIds.length ? `(${cardIds.length}/4)` : ""}
            </summary>
            {hubError && <p>{hubError}</p>}
            {!hub && !hubError && <p>Loading your opened cards…</p>}
            {hub?.cards.length === 0 && <p>No opened cards available.</p>}
            <div className="social-attachment-grid">
              {hub?.cards.map(({ card }) => (
                <label key={card.id}>
                  <input
                    type="checkbox"
                    checked={cardIds.includes(card.id)}
                    disabled={!cardIds.includes(card.id) && cardIds.length >= 4}
                    onChange={(e) =>
                      setCards(
                        e.target.checked
                          ? [...cardIds, card.id]
                          : cardIds.filter((id) => id !== card.id),
                      )
                    }
                  />
                  <FantasyCardArtwork card={card} faceOnly />
                  <small>
                    {card.tier === "CORE"
                      ? "Unlimited Core"
                      : `#${card.serial} / ${card.max_supply.toLocaleString()}`}
                  </small>
                </label>
              ))}
            </div>
          </details>
          <div className="composer-submit actions">
            <button className="button" disabled={busy || !body.trim()}>
              Post
            </button>
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
              }}
            >
              Cancel
            </button>
          </div>
        </form>
        <details>
          <summary>Attach an image (social use only)</summary>
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
        </details>
        <p role="status" className="form-message">
          {message}
        </p>
      </fieldset>
    </div>
  );
}
