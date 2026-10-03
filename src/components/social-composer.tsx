"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { communityAction } from "./social-interactions";
import { EdgeComposer } from "./edge-composer";
import { NativeImagePicker } from "./native-image-picker";
import { PreviewEdgeComposer } from "./preview-edge-composer";
export function SocialComposer({
  previewFixtures = false,
}: {
  previewFixtures?: boolean;
}) {
  const [mode, setMode] = useState<"social" | "edge" | "preview">("edge"),
    [ready, setReady] = useState(false),
    [body, setBody] = useState(""),
    [mediaIds, setMedia] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const router = useRouter();
  useEffect(() => setReady(true), []);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("action", "media_upload");
    setBusy(true);
    try {
      const r = await fetch("/api/community", { method: "POST", body: data });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error ?? "Upload not accepted.");
      const id = v.media?.id ?? v.id;
      if (!id) throw new Error("No upload reference received.");
      setMedia((ids) => [...ids, id]);
      setMessage(
        "Image quarantined for moderation. It does not verify a price or result.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  async function post(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const v = await communityAction({
        action: "post",
        kind: d.get("kind"),
        body,
        sport: d.get("sport") || undefined,
        mediaIds,
        promotional: d.get("promotional") === "on",
        idempotencyKey: key,
      });
      setBody("");
      setMedia([]);
      setKey(crypto.randomUUID());
      setMessage(
        "Social post published. It is excluded from verified performance.",
      );
      if (v.post?.id ?? v.id)
        router.push(`/community/posts/${v.post?.id ?? v.id}`);
      else router.push("/community?tab=latest");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Post not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div data-composer-ready={ready}>
      <div className="community-tabs" aria-label="Content type">
        <button
          disabled={!ready}
          aria-pressed={mode === "edge"}
          onClick={() => setMode("edge")}
        >
          Post Edge
        </button>
        <button
          disabled={!ready}
          aria-pressed={mode === "social"}
          onClick={() => setMode("social")}
        >
          Create post
        </button>
        {previewFixtures && (
          <button
            disabled={!ready}
            aria-pressed={mode === "preview"}
            onClick={() => setMode("preview")}
          >
            DEMO Edge flow
          </button>
        )}
      </div>
      {mode === "preview" && previewFixtures ? (
        <PreviewEdgeComposer />
      ) : mode === "edge" ? (
        <EdgeComposer
          onSocial={(reasoning) => {
            setBody(reasoning);
            setMode("social");
          }}
        />
      ) : (
        <div className="app-panel">
          <h2>Start a sporting conversation.</h2>
          <p>
            Discussion is social content, not a verified performance record.
          </p>
          <form className="app-form" method="post" onSubmit={post}>
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
                <select name="sport">
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
            <label>
              Your post
              <textarea
                required
                maxLength={4000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your analysis, ask a question or discuss the match."
              />
            </label>
            <label className="check">
              <input type="checkbox" name="promotional" />
              <span>
                This post mentions a promotional, boosted or personalised price.
              </span>
            </label>
            <p className="form-help">
              Promotional prices are labelled and excluded from Top Docked.
              Remove names, account IDs, barcodes, balances and other private
              information from slips before uploading.
            </p>
            {mediaIds.length > 0 && (
              <p>
                {mediaIds.length} image(s) awaiting moderation. They are not
                proof of verified odds.
              </p>
            )}
            <button className="button" disabled={busy || !body.trim()}>
              Publish social post
            </button>
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
                Uploads are quarantined and reviewed before display. No OCR or
                screenshot can override provider prices, verify a record or
                settle it.
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
        </div>
      )}
    </div>
  );
}
