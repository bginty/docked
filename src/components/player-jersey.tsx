"use client";
import { useId } from "react";
import { aflJersey } from "@/core/afl-jerseys";
import { nrlJersey } from "@/core/nrl-jerseys";
import {
  jerseyPresentation,
  type JerseyMetadata,
} from "@/core/card-presentation";

/** Original unbranded football illustration. No numbers are inferred from identity. */
export function PlayerJersey({
  card,
  className = "",
  showNumber = true,
}: {
  card?: JerseyMetadata;
  className?: string;
  showNumber?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, ""),
    p = jerseyPresentation(card);
  const displayNumber = showNumber;
  const nrl =
    card?.sport === "nrl" && !card.preserveArtwork
      ? nrlJersey(card.team)
      : undefined;
  const afl =
    card?.sport === "afl" && !card.preserveArtwork
      ? aflJersey(card.team)
      : undefined;
  const rgb = /^#[0-9a-f]{6}$/i.test(p.primary)
    ? [1, 3, 5].map((i) => parseInt(p.primary.slice(i, i + 2), 16))
    : [0, 0, 0];
  const print =
    rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 175
      ? "#152338"
      : "#f4f0e6";
  const sleeveless =
    card?.sport === "afl" || card?.sport === "basketball" || !!nrl;
  const shape = sleeveless
    ? card?.sport === "basketball"
      ? "M54 13L70 15Q90 51 110 15L126 13L132 24Q118 55 139 74L145 164Q90 173 35 164L41 74Q62 55 48 24Z"
      : "M59 13L70 16Q90 39 110 16L121 13L134 25Q121 56 140 69L140 158Q90 170 40 158L40 69Q59 56 46 25Z"
    : card?.sport === "football"
      ? "M58 14L35 25L12 55L31 68L45 49L42 158Q90 166 138 158L135 49L149 68L168 55L145 25L122 14Q90 35 58 14Z"
      : card?.sport === "nrl"
        ? "M57 16L29 27L5 61L29 77L43 58L40 155Q90 169 140 155L137 58L151 77L175 61L151 27L123 16L90 29Z"
        : "M57 13Q42 16 29 24Q17 29 11 36L3 63Q17 74 30 78L43 65Q45 113 40 158Q90 170 140 158Q135 113 137 65L150 78Q163 74 177 63L169 36Q163 29 151 24Q138 16 123 13L111 19Q90 27 69 19Z";
  return (
    <svg
      className={`player-jersey ${className}`}
      viewBox="0 0 180 176"
      aria-hidden="true"
      focusable="false"
      data-uniform={
        card?.sport === "afl"
          ? "guernsey"
          : card?.sport === "basketball"
            ? "basketball-singlet"
            : card?.sport === "nrl"
              ? "rugby-jersey"
              : card?.sport === "football"
                ? "football-shirt"
                : "football-jersey"
      }
      data-number-source={
        displayNumber && p.number !== "—" ? "verified-metadata" : "unavailable"
      }
      data-afl-template={
        afl ? (afl.wedge ? "angular" : "horizontal") : undefined
      }
      data-team-key={afl?.key ?? nrl?.key}
      data-nrl-template={nrl?.pattern}
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
          <circle cx="2.5" cy="2.5" r=".4" fill="#fff" opacity=".06" />
        </pattern>
        <linearGradient id={`${id}-crease`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#000" stopOpacity="0" />
          <stop offset=".42" stopColor="#000" stopOpacity=".5" />
          <stop offset=".59" stopColor="#fff" stopOpacity=".17" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-hem`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#000" stopOpacity=".3" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".17" />
          <stop offset="1" stopColor="#000" stopOpacity=".4" />
        </linearGradient>
        <pattern
          id={`${id}-weave`}
          width="1.5"
          height="1.5"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 .4H1.5M.4 0V1.5"
            stroke="#d8e6f8"
            strokeWidth=".18"
            opacity=".045"
          />
        </pattern>
      </defs>
      <path
        d={shape}
        fill={afl?.upper ?? nrl?.body ?? (card ? p.primary : "#203349")}
        stroke="#99acc2"
        strokeOpacity=".35"
        strokeWidth="1"
      />
      <g clipPath={`url(#${id}-cut)`}>
        {nrl && (
          <g>
            {nrl.pattern === "band" ? (
              <>
                <path d="M35 96H145V116H35Z" fill={nrl.panel} />
                {nrl.accent && (
                  <path
                    d="M35 91H145V94H35ZM35 118H145V121H35Z"
                    fill={nrl.accent}
                  />
                )}
                {nrl.lower && <path d="M35 123H145V127H35Z" fill={nrl.lower} />}
              </>
            ) : nrl.pattern === "split" ? (
              <>
                <path d="M35 101H145V176H35Z" fill={nrl.lower} />
                <path d="M35 94H145V98H35Z" fill={nrl.panel} />
              </>
            ) : (
              <>
                <path
                  d="M35 93L90 121L145 93V108L90 136L35 108Z"
                  fill={nrl.panel}
                />
                {nrl.accent && (
                  <path
                    d="M35 85L90 113L145 85V89L90 117L35 89Z"
                    fill={nrl.accent}
                  />
                )}
              </>
            )}
          </g>
        )}
        {afl &&
          (afl.wedge ? (
            <>
              <path d="M35 69L90 108L145 68V176H35Z" fill={afl.wedge} />
              <path d="M35 137L145 70V176H35Z" fill={afl.lower} />
            </>
          ) : (
            <path d="M35 96H145V176H35Z" fill={afl.lower} />
          ))}
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
          stroke={afl?.trim ?? nrl?.trim ?? p.accent}
          strokeWidth="10"
        />
        <path
          d="M5 58 31 73M149 73 175 58"
          stroke={afl?.trim ?? nrl?.trim ?? p.accent}
          strokeWidth="2"
        />
        {(afl || nrl) && (
          <path
            d="M46 25Q59 56 40 69M134 25Q121 56 140 69"
            fill="none"
            stroke={afl?.trim ?? nrl?.trim}
            strokeWidth="4"
          />
        )}
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
          stroke={afl?.trim ?? nrl?.trim ?? p.accent}
          strokeWidth="3"
        />
        <path
          d="M64 16Q90 29 116 16"
          fill="none"
          stroke="#c3d1e3"
          strokeOpacity=".3"
          strokeWidth="2"
        />
        <path
          d="M43 50Q90 44 137 50"
          fill="none"
          stroke="#000"
          strokeOpacity=".3"
          strokeWidth=".7"
        />
        <path
          d="M43 51Q90 45 137 51"
          fill="none"
          stroke="#fff"
          strokeOpacity=".17"
          strokeWidth=".5"
          strokeDasharray="1.2 1.2"
        />
        <path
          d="M28 28Q18 42 16 55L21 57Q18 42 33 25ZM151 28Q162 40 165 57L159 60Q164 42 146 25Z"
          fill={`url(#${id}-crease)`}
        />
        <path
          d="M40 154Q90 166 140 154L140 159Q90 171 40 159Z"
          fill={`url(#${id}-hem)`}
        />
        {displayNumber && p.number !== "—" && (
          <text
            className="jersey-number"
            x="90"
            y={afl || nrl ? "82" : "119"}
            textAnchor="middle"
            fill={afl?.trim ?? (nrl ? (nrl.number ?? "#f4f4ed") : print)}
            stroke="#050b15"
            strokeWidth="2"
            strokeLinejoin="round"
            paintOrder="stroke"
            fontFamily="Impact, 'Arial Black', Arial, sans-serif"
            fontSize={afl || nrl ? "31" : "61"}
            fontWeight="900"
            letterSpacing="-2"
          >
            {p.number}
          </text>
        )}
        <path
          d="M49 57Q58 84 49 121L47 154 58 158Q54 119 61 89Q62 64 55 54ZM124 55Q116 79 128 112L132 158 120 160Q126 117 115 91Q110 66 124 55Z"
          fill={`url(#${id}-crease)`}
        />
        <path
          d="M52 127Q64 132 70 160L78 163Q67 136 52 127ZM121 120Q114 139 100 165L109 162Q117 141 128 128Z"
          fill={`url(#${id}-fold)`}
        />
        <path d={shape} fill={`url(#${id}-weave)`} />
        <path
          d="M31 27Q39 40 41 58M149 27Q141 40 139 58M44 156Q90 167 136 156"
          fill="none"
          stroke="#fff"
          strokeOpacity=".22"
          strokeWidth=".6"
          strokeDasharray="1 1.3"
        />
      </g>
    </svg>
  );
}
