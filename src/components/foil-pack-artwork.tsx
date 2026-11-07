"use client";
import { finishedFoilPack, type FoilPackProps } from "@/core/foil-pack-artwork";

/** All visible lettering is baked into the foil. No HTML text overlays the pack. */
export function FoilPackArtwork(props: FoilPackProps) {
  const asset = finishedFoilPack(props);
  if (!asset) return null;
  return (
    <div
      className={`foil-pack-art foil-pack-${asset.tier.toLowerCase()}${props.compact ? " foil-pack-compact" : ""}`}
      data-foil-variant={asset.key}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        event.currentTarget.style.setProperty("--foil-y", `${x * 7}deg`);
        event.currentTarget.style.setProperty("--foil-x", `${y * -5}deg`);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--foil-y", "0deg");
        event.currentTarget.style.setProperty("--foil-x", "0deg");
      }}
    >
      <img
        src={asset.src}
        srcSet={asset.srcSet}
        sizes={
          props.compact
            ? "78px"
            : props.presentation === "catalogue"
              ? "(max-width: 600px) 116px, 180px"
              : "(max-width: 600px) 260px, 300px"
        }
        width={1024}
        height={1536}
        alt={asset.label}
        decoding="async"
        loading={
          props.compact || props.presentation === "catalogue" ? "lazy" : "eager"
        }
        draggable={false}
      />
    </div>
  );
}
