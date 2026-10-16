"use client";
import { useId } from "react";
import {
  jerseyPresentation,
  type JerseyMetadata,
} from "@/core/card-presentation";

/** Original unbranded football illustration. No numbers are inferred from identity. */
export function PlayerJersey({
  card,
  className = "",
  showNumber = false,
}: {
  card?: JerseyMetadata;
  className?: string;
  showNumber?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, ""),
    p = jerseyPresentation(card);
  const shape =
    "M57 13Q42 16 29 24Q17 29 11 36L3 63Q17 74 30 78L43 65Q45 113 40 158Q90 170 140 158Q135 113 137 65L150 78Q163 74 177 63L169 36Q163 29 151 24Q138 16 123 13L111 19Q90 27 69 19Z";
  return (
    <svg
      className={`player-jersey ${className}`}
      viewBox="0 0 180 176"
      aria-hidden="true"
      focusable="false"
      data-number-source={
        showNumber && p.number !== "—" ? "verified-metadata" : "unavailable"
      }
    >
      <defs>
        <clipPath id={`${id}-cut`}>
          <path d={shape} />
        </clipPath>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#000" stopOpacity=".45" />
          <stop offset=".17" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".42" stopColor="#fff" stopOpacity=".03" />
          <stop offset=".78" stopColor="#000" stopOpacity=".08" />
          <stop offset="1" stopColor="#000" stopOpacity=".5" />
        </linearGradient>
        <radialGradient id={`${id}-shoulder`} cx=".45" cy="0" r=".95">
          <stop stopColor="#eff6ff" stopOpacity=".26" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".02" />
          <stop offset="1" stopColor="#000" stopOpacity=".23" />
        </radialGradient>
        <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#000" stopOpacity=".16" />
          <stop offset=".48" stopColor="#fff" stopOpacity=".06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-chest`} cx=".45" cy=".3" r=".65">
          <stop stopColor="#eaf2ff" stopOpacity=".13" />
          <stop offset=".7" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </radialGradient>
        <linearGradient id={`${id}-sleeve`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" stopOpacity=".15" />
          <stop offset="1" stopColor="#000" stopOpacity=".38" />
        </linearGradient>
        <pattern
          id={`${id}-mesh`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2.5" cy="2.5" r=".5" fill="#fff" opacity=".09" />
        </pattern>
      </defs>
      <path
        d={shape}
        fill={card ? p.primary : "#203349"}
        stroke="#99acc2"
        strokeOpacity=".35"
        strokeWidth="1"
      />
      <g clipPath={`url(#${id}-cut)`}>
        <path d={shape} fill={`url(#${id}-body)`} />
        <path
          d="M43 40Q90 26 137 40L140 158Q90 170 40 158Z"
          fill={`url(#${id}-chest)`}
        />
        <path
          d="M57 13 69 19Q90 29 111 19L123 13 151 24 143 56Q90 46 37 56L29 24Z"
          fill={`url(#${id}-shoulder)`}
        />
        <path
          d="M29 24 43 39 43 65 30 78 3 63 11 36ZM151 24 137 39 137 65 150 78 177 63 169 36Z"
          fill={`url(#${id}-sleeve)`}
        />
        <path
          d="M7 49 34 65M146 65 173 49"
          stroke={p.accent}
          strokeWidth="10"
        />
        <path d="M5 58 31 73M149 73 175 58" stroke={p.accent} strokeWidth="2" />
        <path
          d="M42 47Q49 57 48 80L52 154 40 158 43 65ZM138 47Q131 57 132 80L128 154 140 158 137 65Z"
          fill="#020814"
          opacity=".26"
        />
        <path
          d="M53 55Q62 94 55 157Q62 159 69 161Q63 108 66 70ZM116 54Q123 103 109 163Q118 162 125 161Q125 106 127 65Z"
          fill={`url(#${id}-fold)`}
        />
        <path
          d="M50 61Q90 53 130 61L135 155Q90 165 45 155Z"
          fill={`url(#${id}-mesh)`}
        />
        <path
          d="M43 43Q49 50 46 69M137 43Q131 50 134 69M44 153Q90 164 136 153"
          fill="none"
          stroke="#e4edff"
          strokeOpacity=".16"
          strokeWidth="1"
        />
        <path
          d="M69 20Q90 29 111 20L123 13 114 32 90 42 66 32 57 13Z"
          fill="#020710"
        />
        <path
          d="M62 18 70 29 90 37 110 29 118 18"
          fill="none"
          stroke={p.accent}
          strokeWidth="3"
        />
        <path
          d="M64 16Q90 29 116 16"
          fill="none"
          stroke="#c3d1e3"
          strokeOpacity=".3"
          strokeWidth="2"
        />
        {showNumber && p.number !== "—" && (
          <text
            className="jersey-number"
            x="90"
            y="120"
            textAnchor="middle"
            fill="#f6f8fb"
            stroke="#050b15"
            strokeWidth="3"
            strokeLinejoin="round"
            paintOrder="stroke"
            fontFamily="Impact, 'Arial Black', Arial, sans-serif"
            fontSize="68"
            fontWeight="900"
            letterSpacing="-2"
          >
            {p.number}
          </text>
        )}
      </g>
    </svg>
  );
}
