import { StaticSportImage } from "./static-sport-image";
import { sportVisuals, visualSport } from "@/content/sport-visuals";
import { assets } from "../../public/images/sports/manifest.json";

export function SportImage({
  sport,
  variant = "tile",
  className = "",
  sizes = "(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 420px",
  preload = false,
  decorative = true,
}: {
  sport: string;
  variant?: "hero" | "header" | "tile" | "editorial" | "atmosphere";
  className?: string;
  sizes?: string;
  preload?: boolean;
  decorative?: boolean;
}) {
  const key = visualSport(sport),
    asset = sportVisuals[key];
  const src =
    variant === "hero" && key === "football"
      ? "/images/sports/hero-football.webp"
      : variant === "atmosphere"
        ? "/images/sports/atmosphere-football.webp"
        : asset.src;
  const image = assets.find((item) => item.path === src);
  return (
    <span className={`sport-image sport-image-${variant} ${className}`}>
      <StaticSportImage
        src={src}
        alt={decorative ? "" : (image?.alt ?? asset.alt)}
        fill
        sizes={sizes}
        preload={preload}
        placeholder={image?.blurDataURL ? "blur" : "empty"}
        blurDataURL={image?.blurDataURL}
        style={{
          objectFit: "cover",
          objectPosition: image?.objectPosition ?? asset.position,
        }}
      />
    </span>
  );
}
