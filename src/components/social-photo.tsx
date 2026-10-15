"use client";
import { useState } from "react";
import type { SocialMedia } from "@/core/community-social";

export function SocialPhoto({ media }: { media: SocialMedia }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!media.url || failed === media.url)
    return (
      <p className="social-photo-unavailable">Photo unavailable. {media.alt}</p>
    );
  return (
    <img
      className="social-photo"
      src={media.url}
      width={media.width}
      height={media.height}
      alt={media.alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(media.url)}
    />
  );
}
