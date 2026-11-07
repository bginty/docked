"use client";

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type RefObject,
} from "react";
import { fantasyAssets } from "@/brand/fantasy-assets";
import type { AwardedCard } from "@/core/pack-opening";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { createCinemaVfx } from "./pack-cinema-vfx";
import {
  cinemaV2Timing,
  cinemaProfiles,
  type CinemaPhase,
  type CinemaTier,
} from "./pack-cinema-v2-model";

function CinemaEmblem({ tier }: { tier: CinemaTier }) {
  const icon = tier === "ICON";
  const hero = icon || tier === "LEGENDARY";
  const id = useId().replace(/:/g, "");
  return (
    <svg className="cinema-v2-emblem" viewBox="0 0 160 110" aria-hidden="true">
      <defs>
        <linearGradient
          id={id}
          x1="0"
          y1="0"
          x2=".7"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="#fffef2" />
          <stop offset=".3" stopColor={icon ? "#ffffff" : "#ffe58b"} />
          <stop offset=".58" stopColor={icon ? "#8abce8" : "#cd8210"} />
          <stop offset=".72" stopColor={icon ? "#ecfcff" : "#ffeab0"} />
          <stop offset="1" stopColor={icon ? "#76caff" : "#ffac1a"} />
        </linearGradient>
      </defs>
      {!hero ? (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        >
          {tier === "CORE" ? (
            <>
              <path d="m80 19 34 20v37L80 96 46 76V39Z" />
              <path d="m62 58 13 13 26-28" />
              <path d="M59 31 80 43l21-12M80 43v13" opacity=".45" />
            </>
          ) : tier === "RARE" ? (
            <>
              <path
                d="m91 8-48 55h33l-7 40 48-61H84Z"
                fill="currentColor"
                fillOpacity=".23"
              />
              <path d="M32 41 21 58l12 18m95-39 12 19-13 20" opacity=".5" />
            </>
          ) : tier === "ELITE" ? (
            <>
              <path
                d="m80 7 14 32 36 4-27 24 8 36-31-19-31 19 8-36-27-24 36-4Z"
                fill="currentColor"
                fillOpacity=".24"
              />
              <path d="m80 30 7 23 23 2-18 13 5 20-17-11-18 11 6-20-18-13 23-2Z" />
            </>
          ) : (
            <>
              <path
                d="m80 4 25 32-25 66-25-66Z"
                fill="currentColor"
                fillOpacity=".3"
              />
              <path
                d="m48 19-27 30 40 43-12-42Zm64 0 27 30-40 43 12-42Z"
                fill="currentColor"
                fillOpacity=".22"
              />
              <path d="m80 4 2 40-27-8m27 8 23-8-25 66" />
            </>
          )}
        </g>
      ) : icon ? (
        <g
          fill={`url(#${id})`}
          stroke="#edffff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        >
          <path d="M14 34 42 8h76l28 26-66 70Z" />
          <path
            d="m14 34 39 1 27 69 27-69 39-1M42 8l11 27L80 8l27 27 11-27M53 35h54"
            fill="none"
          />
          <path d="m53 35 27 69V8Z" fill="#ffffff" opacity=".5" />
          <path d="m107 35-27 69 66-70Z" fill="#4c86d4" opacity=".3" />
          <path d="m42 8 11 27H14Z" fill="#fff" opacity=".8" />
        </g>
      ) : (
        <g fill={`url(#${id})`} stroke="#fff0b3" strokeLinejoin="round">
          <path d="m14 26 31 24L80 8l35 42 31-24-18 61H32Z" />
          <path
            d="m14 26 31 24-7 30Zm66-18v72H38l7-30Zm35 42 13 37-48-7Z"
            fill="#fff6bd"
            opacity=".38"
          />
          <path d="M32 87h96v12H32Z" />
          <path d="M39 103h82" fill="none" strokeWidth="3" />
          <circle cx="14" cy="23" r="5" />
          <circle cx="80" cy="8" r="5" />
          <circle cx="146" cy="23" r="5" />
          <path d="m80 55 7 10-7 11-7-11Z" fill="#fffef4" />
        </g>
      )}
    </svg>
  );
}

function CinemaFrame() {
  return (
    <svg
      className="cinema-v2-frame"
      viewBox="0 0 300 450"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="cinema-frame-bloom"
        d="M27 7h246l20 20v396l-20 20H27L7 423V27Z"
      />
      <path
        className="cinema-frame-metal"
        d="M27 7h246l20 20v396l-20 20H27L7 423V27Z"
      />
      <path
        className="cinema-frame-hot"
        d="M27 7h246l20 20v396l-20 20H27L7 423V27Z"
      />
      <path
        className="cinema-frame-inner"
        d="M30 17h240l13 13v390l-13 13H30l-13-13V30Z"
      />
      <path
        className="cinema-frame-corners"
        d="M6 65V26L26 6h41M233 6h41l20 20v39M294 384v40l-20 20h-41M67 444H26L6 424v-40"
      />
      <path
        className="cinema-frame-detail"
        d="M99 19h102M99 431h102M20 112v35m0 156v35m260-226v35m0 156v35"
      />
    </svg>
  );
}

/** Receipt-driven shared reveal. No awards, inventory mutations or network calls. */
export default function PackCinemaV2({
  card,
  phase,
  reduced,
  revealRef,
  onReveal,
  onPhaseEnd,
  onPhaseStart,
  onInspect,
}: {
  card: AwardedCard;
  phase: CinemaPhase;
  reduced: boolean;
  revealRef: RefObject<HTMLButtonElement | null>;
  onReveal: () => void;
  onPhaseEnd: () => void;
  onPhaseStart: (phase: CinemaPhase) => void;
  onInspect: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof createCinemaVfx> | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const tilt = useRef({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const tier = card.tier as CinemaTier;
  const profile = cinemaProfiles[tier];
  const state = useRef({ phase, tier, reduced });
  useEffect(() => {
    if (!host.current || !shell.current || !back.current || !front.current)
      return;
    engine.current = createCinemaVfx(
      {
        host: host.current,
        card: shell.current,
        back: back.current,
        front: front.current,
      },
      state.current,
    );
    return () => {
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    state.current = { phase, tier, reduced };
    engine.current?.update(state.current);
    if (phase === "mystery") revealRef.current?.focus({ preventScroll: true });
    if (reduced || phase !== "revealed") {
      tilt.current = { x: 0, y: 0 };
      if (anchor.current) anchor.current.style.transform = "";
    }
  }, [phase, tier, reduced, revealRef]);
  function applyTilt(x: number, y: number) {
    tilt.current = {
      x: Math.max(-10, Math.min(10, x)),
      y: Math.max(-12, Math.min(12, y)),
    };
    if (anchor.current)
      anchor.current.style.transform = `perspective(1000px) rotateX(${tilt.current.x}deg) rotateY(${tilt.current.y}deg)`;
  }
  const timing = cinemaV2Timing(tier);
  return (
    <div
      ref={host}
      className={`cinema-v2 ${reduced ? "cinema-v2-reduced" : ""}`}
      data-pack-reveal-phase={phase}
      data-tier={phase === "mystery" ? undefined : tier}
      data-reveal-version="3"
      style={
        {
          "--cinema-charge": `${timing.rarity}ms`,
          "--cinema-flip": `${timing.flip}ms`,
          "--cinema-materialise": `${profile.level >= 4 ? 800 : timing.rarity * 0.55}ms`,
          "--cinema-travel":
            phase === "mystery"
              ? 1
              : [0.35, 0.55, 0.75, 0.9, 1, 1][profile.level],
        } as CSSProperties
      }
    >
      <canvas
        ref={back}
        className="cinema-v2-canvas cinema-v2-background"
        aria-hidden="true"
      />
      <div className="cinema-v2-card-anchor" ref={anchor}>
        <div
          className="cinema-v2-shell"
          ref={shell}
          onAnimationStart={(event) => {
            if (
              event.target === event.currentTarget &&
              ["cinema-v2-charge", "cinema-v2-turn", "cinema-v2-land"].includes(
                event.animationName,
              )
            )
              onPhaseStart(phase);
          }}
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              ((phase === "rarity" &&
                event.animationName === "cinema-v2-charge") ||
                (phase === "flipping" &&
                  event.animationName === "cinema-v2-turn"))
            )
              onPhaseEnd();
          }}
        >
          <div className="cinema-v2-back" aria-hidden="true">
            <span className="cinema-v2-etch" />
            <img
              className="cinema-v2-logo"
              src={fantasyAssets.compactLarge}
              width="400"
              height="110"
              alt=""
              draggable={false}
            />
            {phase === "mystery" ? (
              <svg
                className="cinema-v2-mystery-mark"
                viewBox="0 0 160 110"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <g transform="rotate(-25 80 55)">
                  <path
                    d="M12 55C37 10 123 10 148 55c-25 45-111 45-136 0Z"
                    strokeWidth="3"
                  />
                  <path
                    d="M22 55h116M42 28c-14 17-14 37 0 54m76-54c14 17 14 37 0 54M59 47v16m14-16v16m14-16v16m14-16v16"
                    strokeWidth="2"
                  />
                </g>
              </svg>
            ) : (
              <CinemaEmblem tier={tier} />
            )}
            <span className="cinema-v2-announcement">
              <span className="cinema-v2-rule" />
              <strong>
                {phase === "mystery" ? "REVEAL" : profile.label.toUpperCase()}
              </strong>
              <span className="cinema-v2-rule" />
            </span>
            <svg
              className="cinema-v2-laurel"
              viewBox="0 0 180 70"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M77 60C30 51 24 30 30 6m73 54c47-9 53-30 47-54"
                stroke="currentColor"
              />
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={i} transform={`translate(${i * 7} ${i * 9})`}>
                  <path
                    d="M30 14c-16-3-15-13-15-13 14 1 16 13 16 13Zm3 5C46 7 40 2 40 2 28 6 33 19 33 19Z"
                    fill="currentColor"
                  />
                </g>
              ))}
              {[0, 1, 2, 3, 4].map((i) => (
                <g
                  key={i}
                  transform={`translate(${180 - i * 7} ${i * 9}) scale(-1 1)`}
                >
                  <path
                    d="M30 14c-16-3-15-13-15-13 14 1 16 13 16 13Zm3 5C46 7 40 2 40 2 28 6 33 19 33 19Z"
                    fill="currentColor"
                  />
                </g>
              ))}
              <path d="m90 33 9 10-9 10-9-10Z" fill="currentColor" />
            </svg>
            <span className="cinema-v2-back-caption">
              THE GAME. YOUR COLLECTION.
            </span>
            <CinemaFrame />
          </div>
          <div className="cinema-v2-front" aria-hidden={phase !== "revealed"}>
            {(phase === "flipping" || phase === "revealed") && (
              <FantasyCardArtwork card={card} faceOnly variant="reveal" />
            )}
            <CinemaFrame />
          </div>
          <i
            className="cinema-v2-edge cinema-v2-edge-left"
            aria-hidden="true"
          />
          <i
            className="cinema-v2-edge cinema-v2-edge-right"
            aria-hidden="true"
          />
          <i className="cinema-v2-sheen" aria-hidden="true" />
        </div>
        {phase === "mystery" && (
          <button
            ref={revealRef}
            className="cinema-v2-card-hit"
            aria-label="Reveal card"
            onClick={onReveal}
            type="button"
          />
        )}
        {phase === "revealed" && (
          <button
            className="cinema-v2-card-hit"
            aria-label={`View ${card.name} card details`}
            title="Tap to inspect. Drag or use arrow keys to tilt. Escape resets tilt."
            onPointerDown={(event) => {
              if (reduced) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              if (
                !drag.current ||
                reduced ||
                !event.currentTarget.hasPointerCapture(event.pointerId)
              )
                return;
              const dx = event.clientX - drag.current.x,
                dy = drag.current.y - event.clientY;
              if (Math.abs(dx) + Math.abs(dy) > 6) drag.current.moved = true;
              applyTilt(dy / 8, dx / 8);
            }}
            onPointerCancel={() => {
              drag.current = null;
              applyTilt(0, 0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                applyTilt(0, 0);
              }
              if (
                !reduced &&
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              ) {
                event.preventDefault();
                applyTilt(
                  tilt.current.x +
                    (event.key === "ArrowUp"
                      ? -3
                      : event.key === "ArrowDown"
                        ? 3
                        : 0),
                  tilt.current.y +
                    (event.key === "ArrowLeft"
                      ? -3
                      : event.key === "ArrowRight"
                        ? 3
                        : 0),
                );
              }
            }}
            onClick={() => {
              const moved = drag.current?.moved;
              drag.current = null;
              if (!moved) onInspect();
            }}
            type="button"
          />
        )}
      </div>
      <canvas
        ref={front}
        className="cinema-v2-canvas cinema-v2-foreground"
        aria-hidden="true"
      />
      <div className="cinema-v2-stage-caption" aria-hidden="true">
        {phase === "revealed" ? (
          <>
            <span>{profile.arrival}</span>
            <small>
              {card.sport.toUpperCase()} · {card.position}
            </small>
          </>
        ) : phase === "mystery" ? (
          <small>TAP TO REVEAL</small>
        ) : (
          <small>{profile.caption}</small>
        )}
      </div>
    </div>
  );
}
