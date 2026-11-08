"use client";
import type { SocialProfile } from "@/core/community-social";
import { MemberAvatar } from "./member-avatar";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { communityAction } from "./social-interactions";
import { NativeImagePicker } from "./native-image-picker";
import { useClientReady } from "./use-client-ready";
import { useSocialHub } from "./social-hub";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { FantasySheet } from "./fantasy-player-sheet";
import { boundedFetch as communityRequest } from "@/core/bounded-request";
import { useSport, useSportDraftGuard } from "./sport-context";
export function SocialComposer({
  initialSport,
  inline = false,
  compact = false,
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
  compact?: boolean;
  initialBody?: string;
  memberName?: string;
  memberProfile?: SocialProfile | null;
  communityId?: string;
  playerId?: string;
  initialCardIds?: string[];
  onPublished?: () => void;
  onCancel?: () => void;
}) {
  const [cardIds, setCards] = useState<string[]>(() =>
    initialCardIds.slice(0, 4),
  );
  const [picker, setPicker] = useState(false);
  const [expanded, setExpanded] = useState(
    !compact || !!initialBody || initialCardIds.length > 0,
  );
  const [cardPage, setCardPage] = useState(0);
  const formId = useId();
  const {
    data: hub,
    error: hubError,
    reload: reloadCards,
  } = useSocialHub(undefined, picker || cardIds.length > 0);
  const [search, setSearch] = useState("");
  const [imageUpload, setImageUpload] = useState(false);
  const [preview, setPreview] = useState(false);
  const postForm = useRef<HTMLFormElement>(null);
  const prompt = useRef<HTMLButtonElement>(null);
  const cardGrid = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState(initialBody),
    [mediaIds, setMedia] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const sending = useRef(false);
  const router = useRouter();
  const ready = useClientReady();
  const { sport: workspaceSport } = useSport();
  useSportDraftGuard(
    busy || !!body.trim() || cardIds.length > 0 || mediaIds.length > 0,
  );
  const selectedCards = useMemo(
    () => hub?.cards.filter(({ card }) => cardIds.includes(card.id)) ?? [],
    [hub, cardIds],
  );
  const attachmentSports = [
    ...new Set(selectedCards.map(({ card }) => card.sport)),
  ];
  const attachmentSport =
    attachmentSports.length === 1 ? attachmentSports[0] : undefined;
  const destination = attachmentSport ?? initialSport ?? workspaceSport;
  const matchingCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (
      hub?.cards.filter(
        ({ card }) =>
          (!attachmentSport || card.sport === attachmentSport) &&
          card.name.toLowerCase().includes(term),
      ) ?? []
    );
  }, [hub, search, attachmentSport]);
  const lastCardPage = Math.max(0, Math.ceil(matchingCards.length / 24) - 1);
  const currentCardPage = Math.min(cardPage, lastCardPage);
  const shownCards = matchingCards.slice(
    currentCardPage * 24,
    (currentCardPage + 1) * 24,
  );
  function changeCardPage(page: number) {
    setCardPage(page);
    cardGrid.current?.scrollTo({ top: 0 });
  }
  function beginEditing() {
    setExpanded(true);
    requestAnimationFrame(() =>
      postForm.current?.querySelector("textarea")?.focus(),
    );
  }
  useEffect(() => {
    const focus = () => {
      if (ready && inline && location.hash === "#social-compose") {
        setExpanded(true);
        requestAnimationFrame(() =>
          postForm.current?.querySelector("textarea")?.focus(),
        );
      }
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
    if (
      !["nfl", "afl", "nrl"].includes(destination) ||
      (cardIds.length && attachmentSport !== destination)
    ) {
      setMessage(
        "Choose owned cards from the destination sport before posting.",
      );
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const v = await communityAction({
        action: "post",
        kind: d.get("kind"),
        body,
        sport: destination,
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
      if (compact) setExpanded(false);
      onPublished?.();
      if (inline)
        router.push(
          `/fantasy/social?sport=${destination}&tab=latest${communityId ? `&community=${communityId}` : ""}${playerId ? `&player=${encodeURIComponent(playerId)}` : ""}`,
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
        {compact && !expanded && (
          <div className="composer-launcher">
            <button
              type="button"
              className="composer-prompt"
              ref={prompt}
              aria-expanded={false}
              aria-controls={formId}
              onClick={beginEditing}
            >
              {body || cardIds.length || mediaIds.length
                ? "Continue your draft"
                : "What’s happening?"}
            </button>
            <div className="composer-quick-actions">
              <button
                type="button"
                onClick={() => {
                  setExpanded(true);
                  setPicker(true);
                }}
              >
                Attach cards
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpanded(true);
                  setImageUpload(true);
                }}
              >
                Add image
              </button>
            </div>
          </div>
        )}
        <form
          id={formId}
          hidden={compact && !expanded}
          data-dirty={Boolean(body || cardIds.length || mediaIds.length)}
          ref={postForm}
          className="app-form"
          method="post"
          onSubmit={post}
        >
          <label>
            Post to Docked
            <textarea
              required
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What’s happening in your squad?"
              rows={2}
            />
          </label>
          {compact && (
            <button
              type="button"
              className="composer-minimise"
              aria-expanded={true}
              aria-controls={formId}
              onClick={() => {
                setExpanded(false);
                requestAnimationFrame(() => prompt.current?.focus());
              }}
            >
              Minimise composer
            </button>
          )}
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
              {selectedCards.map(({ card }) => (
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCardPage(0);
                  }}
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
              {hub && !hub.cards.length && <p>No owned cards available.</p>}
              <div className="social-attachment-grid" ref={cardGrid}>
                {shownCards.map(({ card }) => (
                  <label key={card.id}>
                    <input
                      type="checkbox"
                      aria-label={`Attach ${card.name}`}
                      checked={cardIds.includes(card.id)}
                      disabled={
                        !cardIds.includes(card.id) && cardIds.length >= 4
                      }
                      onChange={(e) => {
                        if (!attachmentSport && e.target.checked) {
                          // Keep the focused card mounted when the first selection
                          // narrows the existing attachment policy to one sport.
                          const index = matchingCards
                            .filter((owned) => owned.card.sport === card.sport)
                            .findIndex((owned) => owned.card.id === card.id);
                          setCardPage(Math.floor(index / 24));
                        } else if (!e.target.checked && cardIds.length === 1) {
                          // Removing the last card expands the list across sports.
                          // Keep this checkbox mounted at its original global page.
                          const term = search.trim().toLowerCase();
                          const index = (hub?.cards ?? [])
                            .filter((owned) =>
                              owned.card.name.toLowerCase().includes(term),
                            )
                            .findIndex((owned) => owned.card.id === card.id);
                          setCardPage(Math.max(0, Math.floor(index / 24)));
                        }
                        setCards(
                          e.target.checked
                            ? [...cardIds, card.id]
                            : cardIds.filter((id) => id !== card.id),
                        );
                      }}
                    />
                    <FantasyCardArtwork card={card} faceOnly />
                  </label>
                ))}
              </div>
              {hub && matchingCards.length === 0 && search && (
                <p>No owned players match this search.</p>
              )}
              {matchingCards.length > 24 && (
                <nav
                  className="composer-card-pages"
                  aria-label="Owned card pages"
                >
                  <button
                    type="button"
                    aria-label="Previous cards"
                    disabled={currentCardPage === 0}
                    onClick={() => changeCardPage(currentCardPage - 1)}
                  >
                    Previous
                  </button>
                  <span role="status">
                    {currentCardPage * 24 + 1}–
                    {Math.min((currentCardPage + 1) * 24, matchingCards.length)}{" "}
                    of {matchingCards.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Next cards"
                    disabled={currentCardPage >= lastCardPage}
                    onClick={() => changeCardPage(currentCardPage + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
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
                  if (compact) setExpanded(false);
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
            {selectedCards.map(({ card }) => (
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
