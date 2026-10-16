import { fantasyAssets } from "@/brand/fantasy-assets";
/** Original logo, live labels and lightweight foil styling; no flattened mockup. */
export function PackArtwork({
  name,
  premium = false,
  compact = false,
}: {
  name: string;
  premium?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`pack-wrapper ${premium ? "pack-wrapper-gold" : "pack-wrapper-blue"} ${compact ? "pack-wrapper-compact" : ""}`}
    >
      <span className="wrapper-crimp" aria-hidden="true" />
      <img src={fantasyAssets.splash} width="768" height="521" alt="Docked" />
      <strong>{name}</strong>
      <span className="wrapper-crimp wrapper-crimp-bottom" aria-hidden="true" />
    </div>
  );
}
