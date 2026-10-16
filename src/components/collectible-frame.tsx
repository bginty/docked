"use client";
import { useId } from "react";
/** Lightweight sculpted metal, shared at every scale; entirely decorative. */
export function CollectibleFrame() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      className="collectible-frame"
      viewBox="0 0 340 510"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2=".85" y2="1">
          <stop stopColor="var(--metal-highlight)" />
          <stop offset=".12" stopColor="var(--tier)" />
          <stop offset=".28" stopColor="#17283e" />
          <stop offset=".46" stopColor="var(--tier)" />
          <stop offset=".56" stopColor="var(--metal-highlight)" />
          <stop offset=".68" stopColor="#27364c" />
          <stop offset=".86" stopColor="var(--tier)" />
          <stop offset="1" stopColor="var(--metal-highlight)" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ecf6ff" />
          <stop offset=".25" stopColor="var(--tier)" />
          <stop offset=".5" stopColor="#17263b" />
          <stop offset=".8" stopColor="var(--tier)" />
          <stop offset="1" stopColor="#dcf6ff" />
        </linearGradient>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="var(--tier)" />
          <stop offset=".5" stopColor="#101d30" />
          <stop offset="1" stopColor="var(--tier)" />
        </linearGradient>
      </defs>
      <path
        d="M25 3H315Q337 3 337 26V484Q337 507 314 507H26Q3 507 3 484V26Q3 3 25 3Z"
        fill="none"
        stroke="#132a44"
        strokeWidth="3"
      />
      <path
        d="M26 8H94L88 14H29Q14 14 14 30V89L8 96V29Q8 8 26 8ZM246 8H314Q332 8 332 29V96L326 89V30Q326 14 311 14H252Z M8 344L14 337V478Q14 494 30 494H88L96 502H27Q8 502 8 483ZM326 337L332 344V483Q332 502 313 502H244L252 494H310Q326 494 326 478Z"
        fill={`url(#${id}-metal)`}
        stroke={`url(#${id}-edge)`}
        strokeWidth=".8"
      />
      <path
        d="M96 8H244L251 14H309Q326 14 326 31V477Q326 494 309 494H251L244 502H96L89 494H31Q14 494 14 477V31Q14 14 31 14H89Z"
        fill="none"
        stroke={`url(#${id}-edge)`}
        strokeWidth=".8"
      />
      <path
        d="M29 18H311Q322 18 322 32V478Q322 490 310 490H30Q18 490 18 478V32Q18 18 29 18Z"
        fill="none"
        stroke="var(--tier)"
        strokeOpacity=".5"
        strokeWidth=".65"
      />
      <path
        d="M7 102L18 113V320L7 332ZM333 102L322 113V320L333 332Z"
        fill={`url(#${id}-plate)`}
        stroke={`url(#${id}-edge)`}
        strokeWidth=".8"
      />
      <path
        d="M10 122V300M330 122V300M100 10H240M102 499H238"
        stroke="var(--tier)"
        strokeWidth="1"
        opacity=".7"
      />
      <path
        d="M21 35V73M319 35V73M21 436V474M319 436V474"
        stroke="#d2ecff"
        strokeWidth=".6"
        opacity=".45"
      />
    </svg>
  );
}
