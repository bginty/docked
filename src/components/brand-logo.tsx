import { fantasyAssets } from "@/brand/fantasy-assets";

/** Use supplied image assets, including the wordmark. */
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
  return (
    <span
      className={`brand-logo brand-logo--${variant} canonical-logo canonical-logo--${surface} ${className}`.trim()}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Docked"}
      aria-hidden={decorative || undefined}
    >
      <img
        src={mark ? fantasyAssets.icon512 : fantasyAssets.compact}
        alt=""
        width={mark ? 512 : 400}
        height={mark ? 512 : 100}
        decoding="async"
      />
    </span>
  );
}
