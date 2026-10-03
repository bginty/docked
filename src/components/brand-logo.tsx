import { brandAssets } from "@/brand/brand";

/** Supplied raster artwork only. Dimensions preserve its original aspect ratio. */
export function BrandLogo({
  variant = "wordmark",
  surface = "light",
  className = "",
  decorative = false,
}: {
  variant?: "wordmark" | "mark";
  surface?: "light" | "dark";
  className?: string;
  decorative?: boolean;
}) {
  const mark = variant === "mark";
  const src = mark
    ? surface === "dark"
      ? brandAssets.markWhite
      : brandAssets.mark
    : surface === "dark"
      ? brandAssets.wordmarkOnDark
      : brandAssets.wordmark;
  return (
    <img
      className={`brand-logo brand-logo--${variant} ${className}`.trim()}
      src={src}
      alt={decorative ? "" : "Docked"}
      width={mark ? 800 : 1600}
      height={mark ? 680 : 380}
      decoding="async"
    />
  );
}
