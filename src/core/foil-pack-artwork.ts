/** Artwork identities only. Availability, prices and contents come from the catalogue. */
export type FoilPackProps = {
  name: string;
  premium?: boolean;
  compact?: boolean;
  core?: boolean;
  sport?: string;
  count?: number;
  presentation?: "catalogue";
};
const artworkRoot = "/brand/docked/packs/foil-v2";
/** Verified against the existing Production catalogue; this does not create products. */
export const foilArtworkVariants = (["nfl", "afl", "nrl"] as const).flatMap(
  (sport) => [
    { sport, tier: "STARTER", count: 4 },
    ...(["STANDARD", "PREMIUM"] as const).flatMap((tier) =>
      ([1, 3, 9] as const).map((count) => ({ sport, tier, count })),
    ),
  ],
);
export function foilPackIdentity(props: FoilPackProps) {
  const sport = (
    props.sport ??
    props.name.match(/\b(NFL|AFL|NRL)\b/i)?.[1] ??
    ""
  ).toLowerCase();
  const count =
    props.count ??
    (props.core ? 4 : Number(props.name.match(/\b(1|3|9)\b/)?.[1]));
  if (
    !["nfl", "afl", "nrl"].includes(sport) ||
    !(props.core ? count === 4 : [1, 3, 9].includes(count))
  )
    return null;
  const tier = props.core ? "STARTER" : props.premium ? "PREMIUM" : "STANDARD";
  return { sport, count, tier, key: `${tier}:${sport}:${count}` };
}
export function finishedFoilPack(props: FoilPackProps) {
  const identity = foilPackIdentity(props);
  if (!identity) return null;
  const filename = `${identity.tier.toLowerCase()}-${identity.sport}-${identity.count}`;
  return {
    ...identity,
    src: `${artworkRoot}/${filename}-800.webp`,
    srcSet: `${artworkRoot}/${filename}-240.webp 240w, ${artworkRoot}/${filename}-480.webp 480w, ${artworkRoot}/${filename}-800.webp 800w`,
    label: `Docked ${identity.tier === "STARTER" ? "Weekly Starter" : identity.tier === "PREMIUM" ? "Premium" : "Standard"} ${identity.sport.toUpperCase()} · ${identity.count} ${identity.tier === "STARTER" ? "Core cards" : identity.count === 1 ? "card" : "cards"}`,
  };
}
