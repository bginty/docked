"use client";
import { useState, type FormEvent } from "react";
import type { SocialMedia } from "@/core/community-social";
import { NativeImagePicker } from "./native-image-picker";

/** Optional social illustration only; never input to price verification. */
export function ApprovedEdgeMedia({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [media, setMedia] = useState<SocialMedia[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    try {
      const response = await fetch("/api/community?view=own_media", {
        cache: "no-store",
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Approved images could not be loaded.");
      const approved = (value.media ?? []).filter(
        (item: SocialMedia) => item.status === "approved",
      );
      setMedia(approved);
      setMessage(
        approved.length
          ? "Select up to four approved images."
          : "No approved images available. Images awaiting moderation cannot be attached.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Images unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = new FormData(event.currentTarget);
      body.set("action", "media_upload");
      const response = await fetch("/api/community", { method: "POST", body });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Upload not accepted.");
      setMessage(
        "Image quarantined for moderator review. It has not been attached and cannot verify this Edge.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Upload not confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="app-panel">
      <summary>Optional social image</summary>
      <p className="small-note">
        Approved images illustrate the discussion only. Screenshots never verify
        prices, results or performance. Remove account IDs, balances, barcodes
        and personal information before uploading.
      </p>
      <button
        type="button"
        className="button ghost small"
        disabled={disabled || busy}
        onClick={load}
      >
        Load approved images
      </button>
      {media.length > 0 && (
        <fieldset disabled={disabled || busy}>
          <legend>Approved images</legend>
          {media.map((item) => (
            <label className="check" key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={!selected.includes(item.id) && selected.length >= 4}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
              />
              <span>{item.alt || "Approved image"}</span>
            </label>
          ))}
        </fieldset>
      )}
      <form className="app-form" onSubmit={upload}>
        <NativeImagePicker />
        <label>
          Upload image for review
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={disabled || busy}
          />
        </label>
        <label>
          Image description
          <input
            name="alt"
            required
            maxLength={240}
            disabled={disabled || busy}
          />
        </label>
        <p className="form-help">
          JPEG, PNG or WebP, up to 4 MB. New uploads require approval before
          they can be attached.
        </p>
        <button className="button ghost small" disabled={disabled || busy}>
          Upload for moderation
        </button>
      </form>
      <p role="status" className="form-help">
        {message}
      </p>
    </details>
  );
}
