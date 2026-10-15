"use client";
import { useState, useRef, useEffect } from "react";
import { BrandLogo } from "./brand-logo";
import type { SocialProfile } from "@/core/community-social";

export function MemberAvatar({
  profile,
  size = 44,
}: {
  profile: Pick<SocialProfile, "displayName" | "avatarUrl" | "isOfficial">;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = useRef<HTMLImageElement>(null);
  const url = profile.avatarUrl?.startsWith("/api/community?view=media&")
    ? profile.avatarUrl
    : null;
  useEffect(() => {
    // A cached failure can finish before React attaches the error handler.
    if (url && photo.current?.complete && !photo.current.naturalWidth)
      setFailed(url);
  }, [url]);
  return (
    <span
      className="member-photo"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {profile.isOfficial ? (
        <BrandLogo variant="mark" decorative />
      ) : url && failed !== url ? (
        <img
          ref={photo}
          src={url.includes("variant=avatar") ? url : url + "&variant=avatar"}
          width={size}
          height={size}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(url)}
        />
      ) : (
        <span>
          {profile.displayName.trim().slice(0, 1).toUpperCase() || "D"}
        </span>
      )}
    </span>
  );
}
