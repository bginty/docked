import { visualSport } from "@/content/sport-visuals";

/** Original monochrome pictograms; visual context, never an eligibility signal. */
export function SportIcon({
  sport,
  size = 22,
  className = "",
}: {
  sport: string;
  size?: number;
  className?: string;
}) {
  const key = visualSport(sport);
  const paths = {
    football: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m12 7 4.8 3.5-1.8 5.6H9l-1.8-5.6L12 7Zm0 0V3m4.8 7.5 3.6-1.7M15 16.1l2.2 3.3M9 16.1l-2.2 3.3M7.2 10.5 3.6 8.8" />
      </>
    ),
    basketball: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.6 5.6a9.2 9.2 0 0 1 0 12.8m12.8-12.8a9.2 9.2 0 0 0 0 12.8" />
      </>
    ),
    tennis: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M4.2 7.4c6.5-.4 10.2-1.3 12.4-3.1M7.4 19.7c2.2-6.5 6-10.2 12.4-12.3" />
      </>
    ),
    nfl: (
      <>
        <path d="M3 18C2 7 7 2 18 3c4 11-1 16-12 18l-3-3Z" />
        <path d="m8 16 8-8m-7 5 2 2m0-4 2 2m0-4 2 2M3.4 12.2l8.4 8.4M12.2 3.4l8.4 8.4" />
      </>
    ),
    "horse-racing": (
      <>
        <path d="M7 21h13c-4-6-3-10-4-14l-4-4v4L8 6l-5 7 4 3 4-4c-4 4-6 6-4 9Z" />
        <path d="m12 3-1-1-1 4m3.5 3h.01M5 12l3 1" />
      </>
    ),
    cricket: (
      <>
        <path d="m13 3 2 1-3 5m-1-1 3 2-6 11-5-3L11 8Z" />
        <circle cx="18" cy="17" r="3" />
        <path d="m16.5 14.4 2.8 5.2" />
      </>
    ),
    baseball: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M6 5c5 4 5 10 0 14M18 5c-5 4-5 10 0 14" />
        <path d="m7 7 2-1m0 4 2-.5m-2 4 2 .5m-4 2 2 1m8-10-2-1m0 4-2-.5m2 4-2 .5m4 2-2 1" />
      </>
    ),
    "ice-hockey": (
      <>
        <path d="m8 3 9 14h4v3h-6L5 4m11-1-6 9M7 16l-2 4H2v-3h2l1-3" />
        <ellipse cx="11" cy="20" rx="2" ry="1" />
      </>
    ),
    motorsport: (
      <>
        <path d="M5 22V3m0 1c5-5 9 4 15-1v11c-6 5-10-4-15 1" />
        <path
          d="m6 5 3-1v3L6 8Zm6 2 3 1v3l-3-1Zm5-1 2-1v3l-2 1ZM6 11l3-1v3l-3 1Z"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
    afl: (
      <>
        <path d="M12 2c11 5 11 15 0 20C1 17 1 7 12 2Z" />
        <path d="M12 7v10m-2-8h4m-4 3h4m-4 3h4" />
      </>
    ),
  };
  return (
    <svg
      className={`sport-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[key]}
    </svg>
  );
}
