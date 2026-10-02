import { articleVisuals } from "@/content/sport-visuals";
import { SportImage } from "./sport-image";
export function ArticleImage({
  slug,
  className = "",
  sizes = "(max-width: 760px) 100vw, 760px",
  preload = false,
}: {
  slug: string;
  className?: string;
  sizes?: string;
  preload?: boolean;
}) {
  const asset = articleVisuals[slug] ?? { sport: "football" as const };
  return (
    <SportImage
      sport={asset.sport}
      variant={asset.atmosphere ? "atmosphere" : "editorial"}
      className={`article-feature ${className}`}
      sizes={sizes}
      preload={preload}
    />
  );
}
