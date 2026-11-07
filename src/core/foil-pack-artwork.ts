/** Preview assets are exact product variants, never a generic image for all sports/counts. */
export type FoilPackProps = {
  name: string;
  premium?: boolean;
  compact?: boolean;
  core?: boolean;
  sport?: string;
  count?: number;
};
const artworkRoot = "/brand/docked/packs/foil-v1";
const reviewAssets: Readonly<Record<string, string>> = {
  "STANDARD:afl:9": "standard-afl-9",
  "PREMIUM:nrl:9": "premium-nrl-9",
};
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
    props.core ||
    !["nfl", "afl", "nrl"].includes(sport) ||
    ![1, 3, 9].includes(count)
  )
    return null;
  const tier = props.premium ? "PREMIUM" : "STANDARD";
  return { sport, count, tier, key: `${tier}:${sport}:${count}` };
}
export function finishedFoilPack(props: FoilPackProps) {
  const identity = foilPackIdentity(props);
  if (!identity) return null;
  const filename = reviewAssets[identity.key];
  if (!filename) return null;
  return {
    ...identity,
    src: `${artworkRoot}/${filename}-800.webp`,
    srcSet: `${artworkRoot}/${filename}-480.webp 480w, ${artworkRoot}/${filename}-800.webp 800w`,
    label: `Docked ${identity.tier === "PREMIUM" ? "Premium" : "Standard"} ${identity.sport.toUpperCase()} · ${identity.count} ${identity.count === 1 ? "card" : "cards"}`,
  };
}
