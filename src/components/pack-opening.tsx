"use client";
import { rarityStyle } from "@/core/rarity-theme";
import { brand } from "@/brand/brand";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type CSSProperties,
} from "react";
import Link from "next/link";

import {
  revealIndex,
  revealKey,
  type AwardedCard,
  type PackReceipt,
} from "@/core/pack-opening";
import { FantasySheet } from "./fantasy-player-sheet";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { PackArtwork } from "./pack-artwork";
import { AppIcon } from "./app-icon";
import { packSound } from "./pack-feedback";
import { AcquisitionShare } from "./acquisition-share";
import { IconCelebration } from "./icon-celebration";
import { rarities, rarityRule } from "@/core/card-rarity";
import { NavigationShortcut } from "./navigation-shortcut";
import { packShopHref } from "@/core/pack-presentation";
import {
  PackCinematicBackdrop,
  PackCinematicBack,
  revealTiming,
} from "./pack-cinematic";
import { PackPullShare } from "./pack-pull-share";
import {
  cinemaEligible,
  cinemaV2Timing,
  type CinemaTier,
} from "./pack-cinema-v2-model";
import { createCinemaAudioPlayer } from "./pack-cinema-audio";
import {
  readRevealProgress,
  revealProgressKey,
  revealProgressEvent,
  type RevealProgress,
} from "@/core/pack-reveal-progress";

const PackCinemaV2 = lazy(() => import("./pack-cinema-v2"));
const PackPlayerDetails = lazy(() =>
  import("./collectible-viewer").then((m) => ({
    default: m.CollectibleCardDetails,
  })),
);

type PackStage =
  | "sealed"
  | "waiting"
  | "mystery"
  | "rarity"
  | "flipping"
  | "opening"
  | "revealed"
  | "summary";

function supportsCinematicReveal(card: AwardedCard | undefined) {
  return (
    card?.sport === "nfl" || card?.sport === "afl" || card?.sport === "nrl"
  );
}

function firstCardStage(
  card: AwardedCard | undefined,
  motionOff: boolean,
): PackStage {
  if (!card) return "summary";
  if (supportsCinematicReveal(card)) return "mystery";
  return motionOff ? "revealed" : "opening";
}

function headlinePull(card: AwardedCard) {
  return card.tier === "LEGENDARY" || card.tier === "ICON";
}

export type PackOpeningProps = {
  userId: string;
  name: string;
  sport?: string;
  cardCount?: number;
  packType?: "STANDARD" | "PREMIUM" | "WEEKLY_CORE" | null;
  receipt?: PackReceipt | null;
  openPack: () => Promise<PackReceipt>;
  onClose: () => void;
  onViewCard: (card: AwardedCard) => void;
  ownedIds: string[];
  replay?: boolean;
  preview?: boolean;
  /** Comparison-only option, ignored by real pack callers. */
  legacyRevealPreview?: boolean;
  commercial?: boolean;
  autoOpen?: boolean;
  collectionHref?: string;
  teamHref?: string | null;
  onBuyAnother?: () => void;
  nextPack?: { name: string; open: () => void };
  completionBusy?: boolean;
  completionError?: string;
};

export default function PackOpening(props: PackOpeningProps) {
  const initialReceipt = useRef(props.receipt).current;
  const [receipt, setReceipt] = useState(props.receipt ?? null);
  const [stage, setStage] = useState<PackStage>("sealed");
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(true);
  const [haptics, setHaptics] = useState(false);
  const [simple, setSimple] = useState(false);
  const [replaying, setReplaying] = useState(Boolean(props.receipt));
  const [reduced, setReduced] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [inspected, setInspected] = useState<AwardedCard | null>(null);
  const [exitRequested, setExitRequested] = useState(false);
  const continueRevealing = useRef<HTMLButtonElement>(null);
  const [resume, setResume] = useState<RevealProgress | null>(null);
  const closeDetails = useCallback(() => setInspected(null), []);
  const advancing = useRef(false);
  const busy = useRef(false),
    alive = useRef(true);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const arrival = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);
  const issued = useRef(Boolean(initialReceipt));
  const presentationReplay = useRef(Boolean(props.replay));
  const revealControl = useRef<HTMLButtonElement>(null);
  const skipControl = useRef<HTMLButtonElement>(null);
  const card = receipt?.cards[index];
  const prototype =
    cinemaEligible(card?.sport, card?.tier) &&
    !(props.preview && props.legacyRevealPreview);
  const cinemaSound = useRef<ReturnType<typeof createCinemaAudioPlayer> | null>(
    null,
  );
  const motionOff = reduced || simple;
  const cinematic = supportsCinematicReveal(card);
  const inMotion = stage === "rarity" || stage === "flipping";
  useEffect(() => {
    if (!exitRequested) return;
    const active = document.activeElement as HTMLElement | null;
    continueRevealing.current?.focus();
    return () => {
      if (active?.isConnected) active.focus({ preventScroll: true });
    };
  }, [exitRequested]);
  const save = useCallback(
    (r: PackReceipt, next: number, revealed = false) => {
      try {
        if (supportsCinematicReveal(r.cards[0])) {
          localStorage.setItem(
            revealProgressKey(props.userId, r),
            JSON.stringify({ index: next, revealed, updatedAt: Date.now() }),
          );
          window.dispatchEvent(new Event(revealProgressEvent));
        } else localStorage.setItem(revealKey(props.userId, r), String(next));
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
      setHaptics(localStorage.getItem("docked:pack:haptics") === "on");
      setSimple(localStorage.getItem("docked:pack:reduce-motion") === "on");
    } catch {}
    const r = initialReceipt;
    if (r) {
      let next = 0;
      let alreadyRevealed = false;
      try {
        if (supportsCinematicReveal(r.cards[0])) {
          const progress = readRevealProgress(localStorage, props.userId, r);
          next = progress?.index ?? 0;
          alreadyRevealed = progress?.revealed ?? false;
          if (props.replay && progress && progress.index < r.cards.length)
            setResume(progress);
        } else
          next = revealIndex(
            localStorage.getItem(revealKey(props.userId, r)),
            r.cards.length,
          );
      } catch {}
      if (props.replay) {
        next = 0;
        alreadyRevealed = false;
      }
      setIndex(next);
      setStage(
        alreadyRevealed ? "revealed" : firstCardStage(r.cards[next], false),
      );
    }
    return () => {
      alive.current = false;
      motion.removeEventListener("change", change);
    };
  }, [initialReceipt, props.replay, props.userId]);
  useEffect(() => {
    if (
      receipt &&
      supportsCinematicReveal(receipt.cards[0]) &&
      !presentationReplay.current &&
      (stage === "revealed" || stage === "mystery" || stage === "summary")
    )
      save(receipt, index, stage === "revealed");
  }, [stage, index, receipt, save]);
  function inspectCard(selected: AwardedCard) {
    if (supportsCinematicReveal(selected)) {
      cinemaSound.current?.stop();
      setInspected(selected);
    } else props.onViewCard(selected);
  }
  function requestClose(): false | void {
    if (inspected) {
      closeDetails();
      return false;
    }
    if (exitRequested) {
      setExitRequested(false);
      return false;
    }
    if (
      receipt &&
      supportsCinematicReveal(receipt.cards[0]) &&
      stage !== "summary" &&
      !(stage === "revealed" && index === receipt.cards.length - 1)
    ) {
      cinemaSound.current?.stop();
      setExitRequested(true);
      return false;
    }
    if (
      receipt &&
      !presentationReplay.current &&
      supportsCinematicReveal(receipt.cards[0])
    )
      save(receipt, receipt.cards.length);
    props.onClose();
  }
  function skipAllAndExit() {
    if (receipt && !presentationReplay.current)
      save(receipt, receipt.cards.length);
    props.onClose();
  }
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
    if (!inMotion || !card) return;
    const finish = () =>
      setStage((current) => (current === stage ? "revealed" : current));
    if (motionOff || document.hidden) {
      finish();
      return;
    }
    const next = stage === "rarity" ? "flipping" : "revealed";
    const timing = prototype
      ? cinemaV2Timing(card.tier)
      : revealTiming(card.tier);
    const duration = stage === "rarity" ? timing.rarity : timing.flip;
    // Animation events drive the normal path. Recover if WebView drops one.
    const timer = setTimeout(() => {
      setStage((current) => (current === stage ? next : current));
    }, duration + 250);
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
  }, [stage, card, inMotion, motionOff, prototype]);
  useEffect(() => {
    if (muted || motionOff) cinemaSound.current?.close();
    else if (!inMotion && stage !== "revealed") cinemaSound.current?.stop();
  }, [muted, motionOff, inMotion, stage]);
  useEffect(
    () => () => {
      cinemaSound.current?.close();
    },
    [],
  );
  useEffect(() => {
    advancing.current = false;
    if (stage === "revealed" || stage === "summary")
      title.current?.focus({ preventScroll: true });
    if (stage === "mystery")
      revealControl.current?.focus({ preventScroll: true });
    if (stage === "rarity") skipControl.current?.focus({ preventScroll: true });
  }, [stage, index]);
  useEffect(() => {
    if (reduced || simple) {
      setTilt({ x: 0, y: 0 });
      swipe.current = null;
    }
  }, [reduced, simple]);
  function feedback(legacy = false, sound = true) {
    if (sound && !muted && !document.hidden) packSound();
    if ((haptics || legacy) && !motionOff && !document.hidden) {
      void import("./native-share")
        .then((m) => m.lightNativeFeedback(legacy ? undefined : true))
        .catch(() => {});
    }
  }
  async function open() {
    if (busy.current || issued.current) return;
    busy.current = true;
    setStage("waiting");
    setError("");
    feedback(props.sport === "basketball");
    try {
      const result = await props.openPack();
      if (!result.cards.length) throw Error("No confirmed cards yet.");
      // The award already exists at this point. No animation chooses a player or tier.
      if (!alive.current) return;
      issued.current = true;
      setReceipt(result);
      setIndex(0);
      save(result, 0);
      setStage(firstCardStage(result.cards[0], motionOff));
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
  function beginReveal() {
    if (stage !== "mystery" || !card || advancing.current) return;
    advancing.current = true;
    feedback(false, !prototype);
    if (prototype && !muted && !motionOff && !document.hidden) {
      try {
        if (!cinemaSound.current || cinemaSound.current.closed)
          cinemaSound.current = createCinemaAudioPlayer();
        cinemaSound.current.start(card.tier as CinemaTier);
      } catch {
        /* Optional audio never blocks a confirmed receipt. */
      }
    }
    setStage(motionOff ? "revealed" : "rarity");
  }
  function advance(all = false) {
    if (!receipt || advancing.current || (!all && stage !== "revealed")) return;
    advancing.current = true;
    const next = all ? receipt.cards.length : index + 1;
    if (!cinematic || !presentationReplay.current) save(receipt, next);
    setIndex(next);
    setTilt({ x: 0, y: 0 });
    setStage(firstCardStage(receipt.cards[next], motionOff));
    if (!cinematic) feedback(true);
  }
  const bestTier =
    stage === "summary" && receipt
      ? rarities[
          Math.max(
            ...receipt.cards.map((item) =>
              rarities.findIndex((tier) => tier === item.tier),
            ),
          )
        ]
      : undefined;
  const cinematicSummary = supportsCinematicReveal(receipt?.cards[0]);
  const revealActions = receipt && card && (
    <div className="pack-reveal-actions pack-navigation-actions">
      <div className="pack-player-actions">
        <button
          type="button"
          className="pack-control secondary"
          disabled={stage !== "revealed"}
          onClick={() => inspectCard(card)}
        >
          View Player
        </button>
        <button
          type="button"
          className="pack-next pack-control pack-primary"
          disabled={stage !== "revealed"}
          onClick={() => advance()}
        >
          {index + 1 === receipt.cards.length
            ? "View Pack Summary"
            : "Next Card →"}
        </button>
      </div>
      <div className="pack-minor-actions">
        <PackPullShare
          card={card}
          prominent={headlinePull(card)}
          label="Share My Pull"
        />
        <button
          type="button"
          className="pack-control secondary"
          onClick={() => advance(true)}
        >
          Reveal All
        </button>
        <button
          type="button"
          className="pack-control secondary"
          onClick={requestClose}
        >
          Exit Pack
        </button>
      </div>
    </div>
  );
  return (
    <>
      <FantasySheet
        className={`pack-sheet pack-viewport pack-stage-${stage}${prototype ? " pack-cinema-v2-sheet" : ""}`}
        title={props.replay ? "Replay pack result" : props.name}
        onClose={requestClose}
        historyEntry={
          props.sport !== "basketball" &&
          receipt?.cards[0]?.sport !== "basketball"
        }
      >
        <section
          className={`pack-opening ${motionOff ? "pack-simple" : ""}`}
          aria-label="Docked pack opening"
          hidden={exitRequested}
        >
          <div className="pack-tools">
            {receipt &&
              stage !== "summary" &&
              !(cinematic && stage === "revealed") && (
                <button
                  type="button"
                  className="pack-control secondary"
                  onClick={() => advance(true)}
                  aria-label={
                    cinematic ? "Reveal All" : "Skip remaining reveals"
                  }
                >
                  {cinematic ? "Reveal All" : "Reveal all / Skip"}
                </button>
              )}
            <button
              type="button"
              className="pack-control secondary pack-tool-icon"
              aria-pressed={!muted}
              aria-label={muted ? "Sound off" : "Sound on"}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                try {
                  localStorage.setItem(
                    "docked:pack:sound",
                    next ? "off" : "on",
                  );
                } catch {}
                if (!next) packSound();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M3 9h4l5-4v14l-5-4H3Z" />
                {muted ? (
                  <path d="m16 9 5 6m0-6-5 6" />
                ) : (
                  <path d="M16 8q5 4 0 8M19 5q8 7 0 14" />
                )}
              </svg>
            </button>
            <details className="pack-settings">
              <summary
                className="pack-control secondary pack-tool-icon"
                aria-label="Opening settings"
              >
                <AppIcon name="settings" />
              </summary>
              <div className="pack-settings-content">
                <label>
                  <input
                    type="checkbox"
                    checked={simple || reduced}
                    disabled={reduced}
                    onChange={(event) => {
                      setSimple(event.target.checked);
                      try {
                        localStorage.setItem(
                          "docked:pack:reduce-motion",
                          event.target.checked ? "on" : "off",
                        );
                      } catch {}
                    }}
                  />{" "}
                  Reduce motion
                </label>
                <p>Reduce tilt and reveal animations.</p>
                {reduced && <small>Enabled by your device preference.</small>}
                {props.sport !== "basketball" &&
                  receipt?.cards[0]?.sport !== "basketball" && (
                    <label>
                      <input
                        type="checkbox"
                        checked={haptics}
                        onChange={(event) => {
                          setHaptics(event.target.checked);
                          try {
                            localStorage.setItem(
                              "docked:pack:haptics",
                              event.target.checked ? "on" : "off",
                            );
                          } catch {}
                        }}
                      />
                      Haptic feedback
                    </label>
                  )}
              </div>
            </details>
          </div>
          <p className="pack-kicker">
            {props.preview
              ? "DESIGN PREVIEW · NO CARDS AWARDED"
              : props.replay || replaying
                ? "REPLAY · NO NEW AWARDS"
                : brand.tagline}
          </p>
          {receipt?.notice && <p role="status">{receipt.notice}</p>}
          {resume && receipt && (
            <button
              className="pack-control secondary"
              onClick={() => {
                presentationReplay.current = false;
                setIndex(resume.index);
                setStage(
                  resume.revealed
                    ? "revealed"
                    : firstCardStage(receipt.cards[resume.index], motionOff),
                );
                setResume(null);
              }}
            >
              Resume pack · Card {resume.index + 1} of {receipt.cards.length}
            </button>
          )}
          {(stage === "sealed" || stage === "waiting") && (
            <>
              <h3 ref={title} tabIndex={-1}>
                Your next team starts here.
              </h3>
              <div className="pack-stage">
                <div
                  className="pack-tunnel pack-tunnel-idle"
                  aria-hidden="true"
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <i key={n} style={{ "--ring": n } as CSSProperties} />
                  ))}
                </div>
                <button
                  type="button"
                  className="branded-seal"
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
                  <PackArtwork
                    core={props.packType === "WEEKLY_CORE"}
                    premium={props.packType === "PREMIUM"}
                    name={props.name}
                    sport={
                      props.sport ??
                      new URLSearchParams(
                        props.collectionHref?.split("?")[1],
                      ).get("sport") ??
                      undefined
                    }
                    count={props.cardCount ?? receipt?.cards.length}
                  />
                </button>
              </div>
              <button
                type="button"
                className="pack-open-button pack-control pack-primary"
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
                {props.commercial
                  ? "The animation does not determine your cards or their rarity. No cash redemption."
                  : "Test cards. No cash value. The animation does not determine your cards or their tier."}
              </p>
            </>
          )}
          {prototype &&
            (stage === "mystery" || inMotion || stage === "revealed") &&
            receipt &&
            card && (
              <>
                <p className="pack-count" aria-live="polite">
                  Card {index + 1} of {receipt.cards.length}
                  {stage !== "mystery" && <> · {rarityRule(card.tier).label}</>}
                </p>
                {stage === "revealed" && (
                  <h3 className="sr-only" ref={title} tabIndex={-1}>
                    {card.name}
                  </h3>
                )}
                <Suspense fallback={<p role="status">Preparing your card…</p>}>
                  <PackCinemaV2
                    key={`${receipt.id}:${index}`}
                    card={card}
                    phase={
                      stage === "mystery"
                        ? "mystery"
                        : stage === "rarity"
                          ? "rarity"
                          : stage === "flipping"
                            ? "flipping"
                            : "revealed"
                    }
                    reduced={motionOff || Boolean(inspected)}
                    revealRef={revealControl}
                    onReveal={beginReveal}
                    onPhaseStart={(phase) => cinemaSound.current?.phase(phase)}
                    onInspect={() => inspectCard(card)}
                    onPhaseEnd={() =>
                      setStage((current) =>
                        current === stage
                          ? stage === "rarity"
                            ? "flipping"
                            : "revealed"
                          : current,
                      )
                    }
                  />
                </Suspense>
                {inMotion ? (
                  <button
                    ref={skipControl}
                    type="button"
                    className="pack-control secondary pack-cinematic-skip"
                    onClick={() => {
                      cinemaSound.current?.stop();
                      setStage("revealed");
                    }}
                  >
                    Skip animation
                  </button>
                ) : stage === "revealed" ? (
                  revealActions
                ) : (
                  <p className="pack-inspect-hint">Tap the card to reveal it</p>
                )}
              </>
            )}
          {!prototype &&
            (stage === "mystery" || inMotion) &&
            receipt &&
            card && (
              <>
                <p className="pack-count" aria-live="polite">
                  Card {index + 1} of {receipt.cards.length}
                  {inMotion && <> · {rarityRule(card.tier).label}</>}
                </p>
                <div
                  className="pack-stage pack-card-stage pack-cinematic"
                  data-reveal-index={index}
                  data-pack-reveal-phase={stage}
                  data-tier={inMotion ? card.tier : undefined}
                  style={
                    inMotion
                      ? ({
                          ...rarityStyle(card.tier),
                          "--charge-time": `${revealTiming(card.tier).rarity}ms`,
                          "--flip-time": `${revealTiming(card.tier).flip}ms`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {inMotion && <PackCinematicBackdrop tier={card.tier} />}
                  <PackCinematicBack
                    phase={
                      stage === "mystery"
                        ? "mystery"
                        : stage === "rarity"
                          ? "rarity"
                          : "flipping"
                    }
                    tier={inMotion ? card.tier : undefined}
                    controlRef={revealControl}
                    onReveal={beginReveal}
                    onPhaseEnd={() =>
                      setStage((current) =>
                        current === stage
                          ? stage === "rarity"
                            ? "flipping"
                            : "revealed"
                          : current,
                      )
                    }
                  />
                </div>
                {inMotion ? (
                  <button
                    ref={skipControl}
                    type="button"
                    className="pack-control secondary pack-cinematic-skip"
                    onClick={() => setStage("revealed")}
                  >
                    Skip animation
                  </button>
                ) : (
                  <p className="pack-inspect-hint">Tap the card to reveal it</p>
                )}
              </>
            )}
          {!prototype &&
            (stage === "opening" || stage === "revealed") &&
            receipt &&
            card && (
              <>
                <h3 className="sr-only" ref={title} tabIndex={-1}>
                  {card.name}
                </h3>
                <p className="pack-count" aria-live="polite">
                  {cinematic ? "Card " : ""}
                  {index + 1} of {receipt.cards.length} ·{" "}
                  {rarityRule(card.tier).label.toUpperCase()}
                </p>
                <div
                  key={`${receipt.id}:${index}`}
                  style={rarityStyle(card.tier)}
                  data-reveal-index={index}
                  data-pack-reveal-phase={cinematic ? "revealed" : undefined}
                  data-tier={cinematic ? card.tier : undefined}
                  className={`pack-stage pack-card-stage tier-${card.tier.toLowerCase()} ${cinematic ? "pack-cinematic" : ""} ${stage === "opening" ? "pack-rising" : ""}`}
                >
                  {cinematic && headlinePull(card) && (
                    <div
                      className="pack-cinematic-afterglow"
                      aria-hidden="true"
                    />
                  )}
                  {stage === "opening" && (
                    <>
                      <div className="pack-blue-light" aria-hidden="true" />
                      {index === 0 && !replaying && (
                        <div
                          className="pack-opening-envelope"
                          aria-hidden="true"
                        >
                          <span className="pack-torn-seal" />
                          <PackArtwork
                            core={props.packType === "WEEKLY_CORE"}
                            premium={props.packType === "PREMIUM"}
                            name={props.name}
                            sport={
                              props.sport ??
                              new URLSearchParams(
                                props.collectionHref?.split("?")[1],
                              ).get("sport") ??
                              undefined
                            }
                            count={props.cardCount ?? receipt.cards.length}
                          />
                        </div>
                      )}
                    </>
                  )}
                  {card.tier === "ICON" &&
                    stage === "opening" &&
                    !motionOff && <IconCelebration />}
                  <div
                    ref={arrival}
                    className={`pack-arrival ${motionOff || cinematic ? "" : "pack-turn"}`}
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
                      className="pack-case"
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
                            x: Math.max(
                              -12,
                              Math.min(12, (p.y - e.clientY) / 7),
                            ),
                            y: Math.max(
                              -16,
                              Math.min(16, (e.clientX - p.x) / 7),
                            ),
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
                      <FantasyCardArtwork
                        card={card}
                        faceOnly
                        variant="reveal"
                      />
                    </div>
                  </div>
                </div>
                {cinematic ? (
                  revealActions
                ) : (
                  <div>
                    {cinematic && (
                      <PackPullShare
                        card={card}
                        prominent={headlinePull(card)}
                        label="Share My Pull"
                      />
                    )}
                    <button
                      className="pack-next pack-control pack-primary"
                      type="button"
                      aria-label={
                        index + 1 === receipt.cards.length
                          ? "View pack summary"
                          : "Reveal next card"
                      }
                      disabled={stage === "opening"}
                      onClick={() => advance()}
                    >
                      {index + 1 === receipt.cards.length
                        ? "View all cards"
                        : "Reveal Next"}{" "}
                      →
                    </button>
                  </div>
                )}
                <p className="pack-inspect-hint">
                  {motionOff ? "Reduced movement" : "Drag to tilt"} ·{" "}
                  {props.commercial ? "No cash redemption" : "No cash value"}
                </p>
              </>
            )}
          {stage === "summary" && receipt && (
            <>
              <h3 ref={title} tabIndex={-1}>
                {props.replay || replaying
                  ? "Your original pack result"
                  : props.commercial
                    ? "Your collection"
                    : props.teamHref === null
                      ? "Your test collection"
                      : "Ready to build your team"}
              </h3>
              <p>
                {receipt.cards.length} confirmed cards ·{" "}
                {props.commercial
                  ? "No cash redemption."
                  : "Test cards, no cash value."}
              </p>
              <ul
                className={
                  cinematicSummary
                    ? "pack-summary pack-summary-cinematic"
                    : "pack-summary"
                }
              >
                {receipt.cards.map((c) => (
                  <li
                    key={c.id}
                    className={
                      cinematicSummary
                        ? c.tier === bestTier && c.tier !== "CORE"
                          ? "pack-best-pull"
                          : headlinePull(c)
                            ? "pack-premium-pull"
                            : undefined
                        : undefined
                    }
                    style={
                      cinematicSummary &&
                      (c.tier === bestTier || headlinePull(c))
                        ? rarityStyle(c.tier)
                        : undefined
                    }
                  >
                    <span
                      className={`pack-position tier-${c.tier.toLowerCase()}`}
                      style={rarityStyle(c.tier)}
                    >
                      {c.position}
                    </span>
                    <span>
                      <strong>{c.name}</strong>
                      {cinematicSummary &&
                        c.tier === bestTier &&
                        c.tier !== "CORE" && (
                          <span className="pack-best-label">Best pull</span>
                        )}
                      <small>
                        {c.team} · {rarityRule(c.tier).label} ·{" "}
                        {c.tier === "CORE" ? "Unlimited Core" : `#${c.serial}`}
                      </small>
                    </span>
                    <div className="pack-summary-card-actions">
                      <PackPullShare card={c} />
                      <button
                        type="button"
                        className="pack-control secondary"
                        aria-label={`View ${c.name}`}
                        onClick={() => inspectCard(c)}
                      >
                        View
                      </button>
                    </div>
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
              <div className="pack-actions pack-completion-actions">
                {props.onBuyAnother ? (
                  <button
                    type="button"
                    className="pack-control primary"
                    disabled={props.completionBusy}
                    onClick={props.onBuyAnother}
                  >
                    {props.completionBusy
                      ? "Checking pack…"
                      : "Buy another pack"}
                  </button>
                ) : (
                  <NavigationShortcut
                    compact
                    href={packShopHref(receipt.cards[0]?.sport)}
                  >
                    Browse packs
                  </NavigationShortcut>
                )}
                {props.nextPack && (
                  <button
                    type="button"
                    className="pack-control secondary"
                    disabled={props.completionBusy}
                    onClick={props.nextPack.open}
                  >
                    Open next pack · {props.nextPack.name}
                  </button>
                )}
                {props.teamHref !== null && (
                  <NavigationShortcut
                    compact
                    icon="trophy"
                    href={props.teamHref ?? "/fantasy/play"}
                    onClick={props.onClose}
                  >
                    Build team
                  </NavigationShortcut>
                )}
                <NavigationShortcut
                  compact
                  icon="save"
                  href={props.collectionHref ?? "/fantasy/cards"}
                  onClick={props.onClose}
                >
                  View Collection
                </NavigationShortcut>
              </div>
              {props.completionError && (
                <p role="alert">
                  {props.completionError}{" "}
                  <Link href={packShopHref(receipt.cards[0]?.sport)}>
                    Browse this sport’s packs
                  </Link>
                </p>
              )}
              <p className="pack-disclosure">
                Your pack result is saved. Replaying it never awards additional
                cards.
              </p>
              <button
                type="button"
                className="pack-control"
                onClick={() => {
                  presentationReplay.current = true;
                  setIndex(0);
                  setTilt({ x: 0, y: 0 });
                  setReplaying(true);
                  setStage(firstCardStage(receipt.cards[0], motionOff));
                }}
              >
                Replay saved result · no new cards
              </button>
            </>
          )}
        </section>
        {exitRequested && (
          <section
            className="pack-exit-confirmation"
            aria-label="Keep revealing your pack?"
          >
            <h3>Keep revealing your pack?</h3>
            <p>
              You still have unrevealed cards. Your issued cards are already
              saved.
            </p>
            <div className="pack-actions">
              <button
                ref={continueRevealing}
                type="button"
                className="pack-control pack-primary"
                onClick={() => setExitRequested(false)}
              >
                Continue revealing
              </button>
              <button
                type="button"
                className="pack-control secondary"
                onClick={skipAllAndExit}
              >
                Skip All & Exit
              </button>
            </div>
          </section>
        )}
      </FantasySheet>
      {inspected && (
        <FantasySheet
          title={inspected.name}
          className="collectible-viewer pack-player-details"
          onClose={closeDetails}
          historyEntry
        >
          <button
            type="button"
            className="pack-back-to-pack pack-control secondary"
            onClick={closeDetails}
          >
            ← Back to Pack
          </button>
          <Suspense fallback={<p role="status">Loading player details…</p>}>
            <PackPlayerDetails key={inspected.id} card={inspected} />
          </Suspense>
        </FantasySheet>
      )}
    </>
  );
}
