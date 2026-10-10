"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { communityAction } from "./social-interactions";
import { NativeImagePicker } from "./native-image-picker";
import { useClientReady } from "./use-client-ready";
export function SocialComposer({
  initialSport,
}: {
  previewFixtures?: boolean;
  initialSport?: string;
}) {
  const [body, setBody] = useState(""),
    [mediaIds, setMedia] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const ready = useClientReady();
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || busy) return;
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
      setMessage("Image submitted for moderation.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  async function post(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || busy) return;
    const d = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const v = await communityAction({
        action: "post",
        kind: d.get("kind"),
        body,
        sport: d.get("sport") || undefined,
        mediaIds,
        promotional: false,
        idempotencyKey: key,
      });
      setBody("");
      setMedia([]);
      setKey(crypto.randomUUID());
      setMessage("Social post published.");
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
    <div className="docked-composer" data-composer-ready={ready}>
      <fieldset className="app-panel" disabled={!ready || busy}>
        <h2>Start a sporting conversation.</h2>
        <p>Talk cards, teams and sport with the community.</p>
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
          {mediaIds.length > 0 && (
            <p>
              {mediaIds.length} image(s) awaiting moderation. They are not
              visible until approved.
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
