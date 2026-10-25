import { fantasyAssets } from "@/brand/fantasy-assets";
/** Original logo, live labels and lightweight foil styling; no flattened mockup. */
export function PackArtwork({
  name,
  premium = false,
  compact = false,
  core = false,
  sport,
  count,
}: {
  name: string;
  premium?: boolean;
  compact?: boolean;
  core?: boolean;
  sport?: string;
  count?: number;
}) {
  const sportLabel = (
    sport ??
    name.match(/\b(NFL|AFL|NRL)\b/i)?.[1] ??
    ""
  ).toUpperCase();
  const cards =
    count ?? (core ? 4 : Number(name.match(/\b(1|3|9)\b/)?.[1]) || undefined);
  return (
    <div
      className={`pack-wrapper ${core ? "pack-wrapper-core" : premium ? "pack-wrapper-gold" : "pack-wrapper-blue"} ${compact ? "pack-wrapper-compact" : ""}`}
    >
      <span className="wrapper-crimp" aria-hidden="true" />
      <span className="pack-foil-panel" aria-hidden="true" />
      <img
        src={fantasyAssets.compactLarge}
        width="800"
        height="200"
        alt="Docked"
      />
      <strong>{core ? "Starter" : premium ? "Premium" : "Standard"}</strong>
      <span className="pack-art-sport">{sportLabel}</span>
      {cards && (
        <span className="pack-art-count">
          <b>{cards}</b> {core ? "Core cards" : cards === 1 ? "card" : "cards"}
        </span>
      )}
      <span className="sr-only">{name}</span>
      <span className="wrapper-crimp wrapper-crimp-bottom" aria-hidden="true" />
    </div>
  );
}
