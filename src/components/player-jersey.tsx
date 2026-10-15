"use client";
import { useId } from "react";
import {
  jerseyPresentation,
  type JerseyMetadata,
} from "@/core/card-presentation";

/** Original, unbranded illustration. Numbers come only from the existing verified metadata. */
export function PlayerJersey({
  card,
  className = "",
}: {
  card?: JerseyMetadata;
  className?: string;
}) {
  const id = useId().replace(/:/g, ""),
    p = jerseyPresentation(card);
  const shape =
    "M49 12 17 29 6 48 28 69 43 58 40 144 Q80 151 120 144 L117 58 132 69 154 48 143 29 111 12 99 19 Q80 30 61 19Z";
  return (
    <svg
      className={`player-jersey ${className}`}
      viewBox="0 0 160 156"
      aria-hidden="true"
      focusable="false"
      data-number-source={
        p.number !== "—" ? "verified-metadata" : "unavailable"
      }
    >
      <defs>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#fff" stopOpacity=".2" />
          <stop offset=".25" stopColor="#fff" stopOpacity=".02" />
          <stop offset=".7" stopColor="#000" stopOpacity=".06" />
          <stop offset="1" stopColor="#000" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2=".7">
          <stop stopColor="#fff" stopOpacity=".22" />
          <stop offset=".48" stopColor="#fff" stopOpacity="0" />
          <stop offset=".6" stopColor="#000" stopOpacity=".3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <pattern
          id={`${id}-weave`}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 1H4M1 0V4"
            stroke="#fff"
            strokeOpacity=".035"
            strokeWidth=".5"
          />
        </pattern>
      </defs>
      <path
        d={shape}
        fill={card ? p.primary : "#203349"}
        stroke="#9cacbd"
        strokeOpacity=".5"
        strokeWidth="1.2"
      />
      <path
        d="M14 37 34 56M126 56 146 37"
        fill="none"
        stroke={p.accent}
        strokeWidth="8"
      />
      <path
        d="M10 43 30 62M130 62 150 43"
        fill="none"
        stroke={p.accent}
        strokeWidth="2"
      />
      <path
        d="M49 12 61 19Q80 32 99 19L111 12 103 26Q80 46 57 26Z"
        fill="#08101c"
      />
      <path
        d="M61 20Q80 35 99 20"
        fill="none"
        stroke={p.accent}
        strokeWidth="2.5"
      />
      <path
        d="M44 31Q54 46 45 71M116 31Q106 46 115 71M45 139Q80 144 116 139"
        fill="none"
        stroke="#fff"
        strokeOpacity=".16"
      />
      <path d={shape} fill={`url(#${id}-light)`} />
      <path
        d="M45 61 59 127 45 143ZM113 53 101 127 118 143ZM62 103 81 141 92 145Z"
        fill={`url(#${id}-fold)`}
      />
      <path d={shape} fill={`url(#${id}-weave)`} />
      {p.number !== "—" && (
        <text
          className="jersey-number"
          x="80"
          y="101"
          textAnchor="middle"
          fill="#f8fafc"
          stroke="#06101c"
          strokeWidth="1.5"
          paintOrder="stroke"
          fontFamily="Arial, sans-serif"
          fontSize="48"
          fontWeight="900"
        >
          {p.number}
        </text>
      )}
    </svg>
  );
}
