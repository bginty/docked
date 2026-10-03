import { brandAssets } from "@/brand/brand";

/** The installed Android icon is the master. Never substitute a legacy D variant. */
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
        src={brandAssets.mark}
        alt=""
        width={1024}
        height={1024}
        decoding="async"
      />
      {!mark && (
        <span className="canonical-logo-name" aria-hidden="true">
          DOCKED
        </span>
      )}
    </span>
  );
}
