"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SocialMedia, SocialProfile } from "@/core/community-social";
import { MemberAvatar } from "./member-avatar";
import { communityImageMaxBytes } from "@/core/community-media";

export function AvatarEditor({
  profile,
  media,
  reload,
}: {
  profile: SocialProfile;
  media: SocialMedia[];
  reload: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [crop, setCrop] = useState({ x: 0.5, y: 0.5, zoom: 1 }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const running = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    // A bounded local data URL works with Docked's restrictive image CSP.
    const reader = new FileReader();
    reader.onload = () =>
      setUrl(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => {
      setMessage("This photo could not be read. Choose another image.");
      setFile(null);
    };
    reader.readAsDataURL(file);
    return () => {
      reader.onload = null;
      reader.onerror = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);
  async function save(mediaId: string | null) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "avatar", mediaId }),
      });
      if (!r.ok) throw Error("Photo change could not be confirmed. Try again.");
      setMessage(
        mediaId ? "Profile picture saved." : "Profile picture removed.",
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("action", "avatar_upload");
      body.set("file", file);
      body.set("crop", JSON.stringify(crop));
      body.set("alt", `Profile picture for ${profile.displayName}`);
      const r = await fetch("/api/community", { method: "POST", body });
      const v = await r.json();
      if (!r.ok) throw Error(v.error ?? "Image could not be accepted.");
      setMessage(
        v.media?.status === "approved"
          ? "Crop ready. Choose it below to save your profile picture."
          : "Photo submitted for review. Your current picture stays in place until you choose the approved photo.",
      );
      await reload();
      setFile(null);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const width =
    (dimensions.width / Math.min(dimensions.width, dimensions.height)) *
    crop.zoom *
    100;
  const height =
    (dimensions.height / Math.min(dimensions.width, dimensions.height)) *
    crop.zoom *
    100;
  return (
    <section className="avatar-editor" aria-label="Profile picture">
      <div className="section-row">
        <h3>Profile picture</h3>
        <MemberAvatar profile={profile} size={64} />
      </div>
      <form onSubmit={upload} className="app-form">
        <label>
          Choose a photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (
                f.size > communityImageMaxBytes ||
                !["image/jpeg", "image/png", "image/webp"].includes(f.type)
              ) {
                setMessage("Choose a JPEG, PNG or WebP up to 4 MB.");
                return;
              }
              setFile(f);
              setCrop({ x: 0.5, y: 0.5, zoom: 1 });
              setMessage("");
            }}
          />
        </label>
        {url && (
          <>
            <div
              className="avatar-crop-preview"
              aria-label="Profile photo crop preview"
            >
              <img
                src={url}
                alt="Your selected photo"
                onLoad={(e) =>
                  setDimensions({
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight,
                  })
                }
                onError={() => {
                  setMessage(
                    "This photo could not be decoded. Choose another image.",
                  );
                  setFile(null);
                }}
                style={{
                  width: `${width}%`,
                  height: `${height}%`,
                  left: `${-(width - 100) * crop.x}%`,
                  top: `${-(height - 100) * crop.y}%`,
                }}
              />
            </div>
            {(
              [
                ["zoom", "Zoom", 1, 3],
                ["x", "Horizontal position", 0, 1],
                ["y", "Vertical position", 0, 1],
              ] as const
            ).map(([key, label, min, max]) => (
              <label key={key}>
                {label}
                <input
                  type="range"
                  min={min}
                  max={max}
                  step="0.01"
                  value={crop[key]}
                  onChange={(e) =>
                    setCrop((c) => ({ ...c, [key]: Number(e.target.value) }))
                  }
                  disabled={busy}
                />
              </label>
            ))}
            <div className="actions">
              <button disabled={busy} className="button">
                Submit photo for review
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setFile(null)}
              >
                Cancel crop
              </button>
            </div>
          </>
        )}
        <small>
          JPEG, PNG or WebP · up to 4 MB. Photos are privately reviewed before
          other members can see them.
        </small>
      </form>
      <div className="avatar-choices">
        {media
          .filter((m) => m.status === "approved")
          .map((m) => (
            <button
              type="button"
              disabled={busy}
              key={m.id}
              onClick={() => save(m.id)}
              aria-label={`Use photo: ${m.alt}`}
            >
              <MemberAvatar
                profile={{
                  displayName: profile.displayName,
                  isOfficial: false,
                  avatarUrl: `/api/community?view=media&id=${m.id}`,
                }}
                size={64}
              />
              <span>Use photo</span>
            </button>
          ))}
      </div>
      {media.some((m) => m.status !== "approved") && (
        <details>
          <summary>Photos under review</summary>
          {media
            .filter((m) => m.status !== "approved")
            .map((m) => (
              <p key={m.id}>
                {m.alt} · {m.status}
              </p>
            ))}
        </details>
      )}
      {profile.avatarUrl && (
        <button type="button" disabled={busy} onClick={() => save(null)}>
          Remove profile picture
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
