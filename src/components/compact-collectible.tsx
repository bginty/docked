"use client";
import { useEffect, useRef, useState } from "react";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import type { AwardedCard } from "@/core/pack-opening";

/** Scale the whole canonical 300 × 450 face, including minimum font sizes. */
export function CompactCollectible({
  card,
  onInspect,
}: {
  card: AwardedCard;
  onInspect?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const resize = () => setScale(node.getBoundingClientRect().width / 300);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="compact-collectible-canvas">
      <div
        className="compact-collectible-inner"
        style={{
          transform: `scale(${scale})`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <FantasyCardArtwork card={card} faceOnly onInspect={onInspect} />
      </div>
    </div>
  );
}
