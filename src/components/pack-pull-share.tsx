"use client";

import { lazy, Suspense, useState } from "react";
import type { AwardedCard } from "@/core/pack-opening";

// Artwork rasterisation and native export code are loaded only after a share tap.
const PullImagePreview = lazy(() => import("./pack-pull-preview"));

export function PackPullShare({
  card,
  prominent = false,
  label = "Share",
}: {
  card: AwardedCard;
  prominent?: boolean;
  label?: "Share" | "Share My Pull";
}) {
  const [open, setOpen] = useState(false);
  if (!["nfl", "afl", "nrl"].includes(card.sport)) return null;
  return (
    <>
      <button
        type="button"
        className={
          prominent
            ? "pack-control pack-pull-trigger pack-pull-trigger-prominent"
            : "pack-control secondary pack-pull-trigger"
        }
        onClick={() => setOpen(true)}
        aria-label={label === "Share My Pull" ? label : "Share " + card.name}
      >
        {label}
      </button>
      {open && (
        <Suspense fallback={<p role="status">Loading share preview…</p>}>
          <PullImagePreview card={card} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
