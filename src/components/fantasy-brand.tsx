import { fantasyAssets } from "@/brand/fantasy-assets";
export function FantasyLogo() {
  return (
    <picture className="fantasy-logo">
      <source media="(min-width: 768px)" srcSet={fantasyAssets.horizontal} />
      <img src={fantasyAssets.compact} alt="Docked" width={400} height={63} />
    </picture>
  );
}
export function FantasyHero() {
  return (
    <picture className="fantasy-hero-art">
      <source media="(max-width: 600px)" srcSet={fantasyAssets.heroMobile} />
      <source media="(max-width: 1100px)" srcSet={fantasyAssets.heroTablet} />
      <img
        src={fantasyAssets.hero}
        alt="Docked. Collect. Build. Compete."
        width={1600}
        height={900}
        fetchPriority="high"
      />
    </picture>
  );
}
