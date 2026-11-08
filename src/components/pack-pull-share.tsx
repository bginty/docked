"use client";

import { useId, useRef, useState } from "react";
import type { AwardedCard } from "@/core/pack-opening";

// Preload code on intent, without rasterising nine images or touching inventory.
const loadPullPreview = () => import("./pack-pull-preview");

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
  const [selected, setSelected] = useState<AwardedCard | null>(null);
  const [PullImagePreview, setPreview] = useState<
    (typeof import("./pack-pull-preview"))["default"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const messageId = useId();

  async function shareSelectedCard() {
    if (pending.current || open) return;
    // Freeze the exact selection even if the reveal advances while code loads.
    setSelected(card);
    setError("");
    if (PullImagePreview) {
      setOpen(true);
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const preview = await loadPullPreview();
      setPreview(() => preview.default);
      setOpen(true);
    } catch {
      setError(
        "Sharing could not load. Check your connection and tap Share to try again.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  function preload() {
    void loadPullPreview().catch(() => {
      // Preloading is optional; a later explicit share can retry the download.
    });
  }
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
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => void shareSelectedCard()}
        disabled={loading}
        aria-busy={loading}
        aria-describedby={error ? messageId : undefined}
        aria-label={label === "Share My Pull" ? label : "Share " + card.name}
      >
        {label}
      </button>
      {error && (
        <p id={messageId} role="alert">
          {error}
        </p>
      )}
      {open && selected && PullImagePreview && (
        <PullImagePreview
          card={selected}
          autoShare
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
