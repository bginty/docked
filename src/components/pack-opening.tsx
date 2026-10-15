"use client";
import { rarityFrame, rarityStyle } from "@/core/rarity-theme";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { fantasyAssets } from "@/brand/fantasy-assets";
import {
  revealIndex,
  revealKey,
  type AwardedCard,
  type PackReceipt,
} from "@/core/pack-opening";
import { FantasySheet } from "./fantasy-player-sheet";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { packSound } from "./pack-feedback";
import { AcquisitionShare } from "./acquisition-share";
import { rarityRule } from "@/core/card-rarity";

export type PackOpeningProps = {
  userId: string;
  name: string;
  receipt?: PackReceipt | null;
  openPack: () => Promise<PackReceipt>;
  onClose: () => void;
  onViewCard: (card: AwardedCard) => void;
  ownedIds: string[];
  replay?: boolean;
  preview?: boolean;
  autoOpen?: boolean;
  collectionHref?: string;
  teamHref?: string | null;
};

export default function PackOpening(props: PackOpeningProps) {
  const initialReceipt = useRef(props.receipt).current;
  const [receipt, setReceipt] = useState(props.receipt ?? null);
  const [stage, setStage] = useState<
    "sealed" | "waiting" | "opening" | "revealed" | "summary"
  >("sealed");
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(true);
  const [simple, setSimple] = useState(false);
  const [replaying, setReplaying] = useState(Boolean(props.receipt));
  const [reduced, setReduced] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const advancing = useRef(false);
  const busy = useRef(false),
    alive = useRef(true);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const arrival = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);
  const save = useCallback(
    (r: PackReceipt, next: number) => {
      try {
        localStorage.setItem(revealKey(props.userId, r), String(next));
      } catch {
        /* Storage denial affects presentation only. */
      }
    },
    [props.userId],
  );
  useEffect(() => {
    alive.current = true;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(motion.matches);
    change();
    motion.addEventListener("change", change);
    try {
      setMuted(localStorage.getItem("docked:pack:sound") !== "on");
    } catch {}
    const r = initialReceipt;
    if (r) {
      let next = 0;
      try {
        next = revealIndex(
          localStorage.getItem(revealKey(props.userId, r)),
          r.cards.length,
        );
      } catch {}
      if (props.replay) next = 0;
      setIndex(next);
      setStage(next === r.cards.length ? "summary" : "opening");
    }
    return () => {
      alive.current = false;
      motion.removeEventListener("change", change);
    };
  }, [initialReceipt, props.replay, props.userId]);
  useEffect(() => {
    if (stage !== "opening") return;
    if (reduced || simple || document.hidden) {
      setStage("revealed");
      return;
    }
    const finish = () => {
      // Finish the compositor's turn before enabling inspection. Never remove
      // an in-flight animation merely because a wall-clock timer has elapsed.
      arrival.current
        ?.getAnimations()
        .forEach((animation) => animation.finish());
      setStage("revealed");
    };
    // Recovery only: normal completion comes from animationend. Allow delayed
    // frames/startup without cutting the turn short on a busy mobile browser.
    const timer = setTimeout(finish, 5000);
    // Backgrounding ends presentation only; the receipt is already persisted.
    const hidden = () => {
      if (document.hidden) finish();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", finish);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", finish);
    };
  }, [stage, index, reduced, simple]);
  useEffect(() => {
    advancing.current = false;
    if (stage === "revealed" || stage === "summary")
      title.current?.focus({ preventScroll: true });
  }, [stage, index]);
  function feedback() {
    if (!muted && !document.hidden) packSound();
    if (!reduced)
      void import("./native-share")
        .then((m) => m.lightNativeFeedback())
        .catch(() => {});
  }
  async function open() {
    if (busy.current || receipt) return;
    busy.current = true;
    setStage("waiting");
    setError("");
    feedback();
    try {
      const result = await props.openPack();
      if (!result.cards.length) throw Error("No confirmed cards yet.");
      // The award already exists at this point. No animation chooses a player or tier.
      if (!alive.current) return;
      setReceipt(result);
      setIndex(0);
      save(result, 0);
      setStage(
        matchMedia("(prefers-reduced-motion: reduce)").matches || simple
          ? "revealed"
          : "opening",
      );
    } catch {
      if (alive.current) {
        setError(
          "Could not confirm your pack. Retry to retrieve the same result; your cards will not be rerolled.",
        );
        setStage("sealed");
      }
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (props.autoOpen && !initialReceipt && !autoStarted.current) {
      autoStarted.current = true;
      void open();
    }
    // One attempt for this mounted entitlement; retries use the visible button.
  }, [props.autoOpen, initialReceipt]);
  function advance(all = false) {
    if (!receipt || advancing.current || (!all && stage !== "revealed")) return;
    advancing.current = true;
    const next = all ? receipt.cards.length : index + 1;
    save(receipt, next);
    setIndex(next);
    setTilt({ x: 0, y: 0 });
    setStage(
      next === receipt.cards.length
        ? "summary"
        : motionOff
          ? "revealed"
          : "opening",
    );
    feedback();
  }
  const card = receipt?.cards[index];
  const motionOff = reduced || simple;
  return (
    <FantasySheet
      className={`pack-sheet pack-viewport pack-stage-${stage}`}
      title={props.replay ? "Replay pack result" : props.name}
      onClose={props.onClose}
    >
      <section
        className={`pack-opening ${motionOff ? "pack-simple" : ""}`}
        aria-label="Docked pack opening"
      >
        <div className="pack-tools">
          {receipt && stage !== "summary" && (
            <button
              type="button"
              onClick={() => advance(true)}
              aria-label="Skip remaining reveals"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            aria-pressed={!muted}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              try {
                localStorage.setItem("docked:pack:sound", next ? "off" : "on");
              } catch {}
              if (!next) packSound();
            }}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button
            type="button"
            aria-pressed={simple}
            onClick={() => setSimple(!simple)}
          >
            Simple view
          </button>
        </div>
        <p className="pack-kicker">
          {props.preview
            ? "DESIGN PREVIEW · NO CARDS AWARDED"
            : props.replay || replaying
              ? "REPLAY · NO NEW AWARDS"
              : "COLLECT. BUILD. COMPETE."}
        </p>
        {(stage === "sealed" || stage === "waiting") && (
          <>
            <h3 ref={title} tabIndex={-1}>
              Your next team starts here.
            </h3>
            <div className="pack-stage">
              <div className="pack-tunnel pack-tunnel-idle" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((n) => (
                  <i key={n} style={{ "--ring": n } as CSSProperties} />
                ))}
              </div>
              <button
                type="button"
                className="docked-foil-pack"
                disabled={stage === "waiting"}
                aria-label="Open pack seal"
                onClick={() => void open()}
                onPointerDown={(e) => {
                  swipe.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={(e) => {
                  const p = swipe.current;
                  swipe.current = null;
                  if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 45)
                    void open();
                }}
                onPointerCancel={() => {
                  swipe.current = null;
                }}
              >
                <span className="pack-seal" aria-hidden="true" />
                <img
                  src="/brand/docked/icons/docked-icon-512.png"
                  width="132"
                  height="132"
                  alt="Docked"
                />
                <span className="pack-foil-line" aria-hidden="true" />
                <span className="pack-sport">FANTASY CARDS</span>
                <span className="pack-edition">{props.name}</span>
                <span
                  className="pack-seal pack-seal-bottom"
                  aria-hidden="true"
                />
              </button>
            </div>
            <button
              type="button"
              className="pack-open-button"
              disabled={stage === "waiting"}
              onClick={() => void open()}
            >
              Open pack
            </button>
            <p role="status">
              {stage === "waiting"
                ? "Confirming your cards…"
                : "Tap the pack or swipe across its top seal."}
            </p>
            {stage === "waiting" && (
              <p>
                You can close this panel safely. Your result can be retrieved
                from Cards.
              </p>
            )}
            {error && (
              <p className="pack-error" role="alert">
                {error}
              </p>
            )}
            <p className="pack-disclosure">
              Test cards. No cash value. The animation does not determine your
              cards or their tier.
            </p>
          </>
        )}
        {(stage === "opening" || stage === "revealed") && receipt && card && (
          <>
            <h3 className="sr-only" ref={title} tabIndex={-1}>
              {card.name}
            </h3>
            <p className="pack-count" aria-live="polite">
              {index + 1} of {receipt.cards.length} ·{" "}
              {rarityRule(card.tier).label.toUpperCase()}
            </p>
            <div
              key={`${receipt.id}:${index}`}
              style={rarityStyle(card.tier)}
              data-reveal-index={index}
              className={`pack-stage pack-card-stage tier-${card.tier.toLowerCase()} ${stage === "opening" ? "pack-rising" : ""}`}
            >
              {stage === "opening" && (
                <>
                  <div className="pack-blue-light" aria-hidden="true" />
                  {index === 0 && !replaying && (
                    <div className="pack-opening-envelope" aria-hidden="true">
                      <span className="pack-torn-seal" />
                      <img
                        src="/brand/docked/icons/docked-icon-512.png"
                        width="132"
                        height="132"
                        alt=""
                      />
                      <strong>DOCKED</strong>
                      <small>COLLECT. BUILD. COMPETE.</small>
                    </div>
                  )}
                </>
              )}
              {card.tier === "ICON" && stage === "opening" && !motionOff && (
                <div className="pack-icon-celebration" aria-hidden="true">
                  <span className="icon-halo" />
                  {[0, 1, 2].map((burst) => (
                    <span
                      className={`icon-firework icon-firework-${burst}`}
                      key={burst}
                    >
                      {Array.from({ length: 10 }, (_, ray) => (
                        <i
                          key={ray}
                          style={{ "--ray": `${ray * 36}deg` } as CSSProperties}
                        />
                      ))}
                    </span>
                  ))}
                </div>
              )}
              <div
                ref={arrival}
                className={`pack-arrival ${motionOff ? "" : "pack-turn"}`}
                onAnimationEnd={(e) => {
                  if (
                    stage === "opening" &&
                    e.target === e.currentTarget &&
                    e.animationName === "docked-single-reveal"
                  )
                    setStage("revealed");
                }}
              >
                <div className="pack-card-back" aria-hidden="true" />
                <div
                  className={`pack-case ${rarityFrame(card.tier)}`}
                  tabIndex={0}
                  role="group"
                  aria-label={`Inspect ${card.name}. Drag or use arrow keys to tilt; Escape resets tilt.`}
                  style={
                    {
                      "--tilt-x": `${tilt.x}deg`,
                      "--tilt-y": `${tilt.y}deg`,
                    } as CSSProperties
                  }
                  onPointerDown={(e) => {
                    if (!motionOff && stage === "revealed") {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      swipe.current = { x: e.clientX, y: e.clientY };
                    }
                  }}
                  onPointerMove={(e) => {
                    const p = swipe.current;
                    if (
                      p &&
                      e.currentTarget.hasPointerCapture(e.pointerId) &&
                      !motionOff &&
                      stage === "revealed"
                    )
                      setTilt({
                        x: Math.max(-12, Math.min(12, (p.y - e.clientY) / 7)),
                        y: Math.max(-16, Math.min(16, (e.clientX - p.x) / 7)),
                      });
                  }}
                  onPointerUp={() => {
                    swipe.current = null;
                  }}
                  onPointerCancel={() => {
                    swipe.current = null;
                    setTilt({ x: 0, y: 0 });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setTilt({ x: 0, y: 0 });
                    }
                    if (
                      !motionOff &&
                      stage === "revealed" &&
                      [
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      setTilt((t) => ({
                        x: Math.max(
                          -12,
                          Math.min(
                            12,
                            t.x +
                              (e.key === "ArrowUp"
                                ? -3
                                : e.key === "ArrowDown"
                                  ? 3
                                  : 0),
                          ),
                        ),
                        y: Math.max(
                          -16,
                          Math.min(
                            16,
                            t.y +
                              (e.key === "ArrowLeft"
                                ? -3
                                : e.key === "ArrowRight"
                                  ? 3
                                  : 0),
                          ),
                        ),
                      }));
                    }
                  }}
                >
                  <div className="pack-case-label">
                    <img
                      src={fantasyAssets.compact}
                      width="90"
                      height="25"
                      alt="Docked"
                    />
                    <span>
                      Test economy · {rarityRule(card.tier).label.toUpperCase()}
                    </span>
                  </div>
                  <FantasyCardArtwork card={card} faceOnly />
                  <div className="pack-case-foot">
                    {card.sport.toUpperCase()} · {card.position} ·{" "}
                    {card.tier === "CORE"
                      ? "Core · unlimited"
                      : `#${String(card.serial).padStart(3, "0")} / ${card.max_supply.toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>
            <button
              className="pack-next"
              type="button"
              aria-label={
                index + 1 === receipt.cards.length
                  ? "View pack summary"
                  : "Reveal next card"
              }
              disabled={stage === "opening"}
              onClick={() => advance()}
            >
              →
            </button>
            <p className="pack-inspect-hint">
              {motionOff ? "Reduced movement" : "Drag to tilt"} · No cash value
            </p>
          </>
        )}
        {stage === "summary" && receipt && (
          <>
            <h3 ref={title} tabIndex={-1}>
              {props.replay || replaying
                ? "Your original pack result"
                : props.teamHref === null
                  ? "Your test collection"
                  : "Ready to build your team"}
            </h3>
            <p>
              {receipt.cards.length} confirmed cards · Test cards, no cash
              value.
            </p>
            <ul className="pack-summary">
              {receipt.cards.map((c) => (
                <li key={c.id}>
                  <span
                    className={`pack-position tier-${c.tier.toLowerCase()}`}
                    style={rarityStyle(c.tier)}
                  >
                    {c.position}
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.team} · {rarityRule(c.tier).label} ·{" "}
                      {c.tier === "CORE" ? "Unlimited Core" : `#${c.serial}`}
                    </small>
                  </span>
                  <button
                    type="button"
                    aria-label={`View ${c.name}`}
                    onClick={() => props.onViewCard(c)}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
            {!props.preview && !props.replay && !replaying && (
              <AcquisitionShare
                member={props.userId}
                reference={receipt.id}
                cards={receipt.cards.filter((c) =>
                  props.ownedIds.includes(c.id),
                )}
              />
            )}
            <div className="pack-actions">
              {props.teamHref !== null && (
                <Link
                  className="button"
                  href={props.teamHref ?? "/fantasy/play"}
                  onClick={props.onClose}
                >
                  Build team
                </Link>
              )}
              <button type="button" onClick={props.onClose}>
                Back to collection
              </button>
            </div>
            <p className="pack-disclosure">
              Your pack result is saved. Replaying it never awards additional
              cards.
            </p>
            <button
              type="button"
              onClick={() => {
                setIndex(0);
                setTilt({ x: 0, y: 0 });
                setReplaying(true);
                setStage(motionOff ? "revealed" : "opening");
              }}
            >
              Replay saved result · no new cards
            </button>
          </>
        )}
      </section>
    </FantasySheet>
  );
}
