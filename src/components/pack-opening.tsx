"use client";
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
import {rarityRule} from '@/core/card-rarity';

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
  const busy = useRef(false),
    alive = useRef(true);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
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
      setStage(next === r.cards.length ? "summary" : "revealed");
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
    const finish = () => setStage("revealed");
    const timer = setTimeout(finish, 6000);
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
  }, [stage, reduced, simple]);
  useEffect(() => {
    if (stage === "revealed" || stage === "summary") title.current?.focus();
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
      setStage(reduced || simple ? "revealed" : "opening");
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
  function advance(all = false) {
    if (!receipt) return;
    const next = all ? receipt.cards.length : index + 1;
    save(receipt, next);
    setIndex(next);
    setTilt({ x: 0, y: 0 });
    setStage(next === receipt.cards.length ? "summary" : "revealed");
    feedback();
  }
  const card = receipt?.cards[index];
  const motionOff = reduced || simple;
  return (
    <FantasySheet
      className="pack-sheet"
      title={props.replay ? "Replay pack result" : props.name}
      onClose={props.onClose}
    >
      <section
        className={`pack-opening ${motionOff ? "pack-simple" : ""}`}
        aria-label="Docked pack opening"
      >
        <div className="pack-tools">
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
              Free beta cards. No cash value. The animation does not determine
              your cards or their tier.
            </p>
          </>
        )}
        {(stage === "opening" || stage === "revealed") && receipt && card && (
          <>
            <h3 ref={title} tabIndex={-1}>
              {stage === "opening" ? "Your cards are confirmed" : card.name}
            </h3>
            <p className="pack-count" aria-live="polite">
              Card {index + 1} of {receipt.cards.length} · {rarityRule(card.tier).label.toUpperCase()}
            </p>
            <div
              className={`pack-stage pack-card-stage tier-${card.tier.toLowerCase()} ${stage === "opening" ? "pack-rising" : ""}`}
            >
              {stage === "opening" && (
                <>
                  <div className="pack-tunnel" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <i key={n} style={{ "--ring": n } as CSSProperties} />
                    ))}
                  </div>
                  <div className="pack-blue-light" aria-hidden="true" />
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
                </>
              )}
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
                  if (!motionOff) {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    swipe.current = { x: e.clientX, y: e.clientY };
                  }
                }}
                onPointerMove={(e) => {
                  const p = swipe.current;
                  if (
                    p &&
                    e.currentTarget.hasPointerCapture(e.pointerId) &&
                    !motionOff
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
                    {card.season} · {rarityRule(card.tier).label.toUpperCase()}
                  </span>
                </div>
                <FantasyCardArtwork card={card} />
                <div className="pack-case-foot">
                  {card.sport.toUpperCase()} · {card.position} · #
                  {String(card.serial).padStart(3, "0")}
                </div>
              </div>
            </div>
            {stage === "opening" ? (
              <button type="button" onClick={() => setStage("revealed")}>
                Skip animation
              </button>
            ) : (
              <>
                <p className="pack-inspect-hint">
                  {motionOff
                    ? "Simple view · all card details are available below."
                    : "Drag the case to inspect · or use arrow keys"}
                </p>
                <dl className="pack-details">
                  <div>
                    <dt>Current team</dt>
                    <dd>{card.team}</dd>
                  </div>
                  <div>
                    <dt>Edition</dt>
                    <dd>
                      {card.season} · {card.kind.replaceAll("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {card.tier === "CORE" ? "Supply" : "Permanent serial"}
                    </dt>
                    <dd>
                      {card.tier === "CORE"
                        ? "Free Core · unlimited"
                        : `${card.serial} / ${card.max_supply}`}
                    </dd>
                  </div>
                </dl>
                {card.edition_team && card.edition_team !== card.team && (
                  <p>Edition team: {card.edition_team}</p>
                )}
                {!props.ownedIds.includes(card.id) && (
                  <p>
                    This card is part of this pack’s original result but is no
                    longer in your collection.
                  </p>
                )}
                <div className="pack-actions">
                  <button type="button" onClick={() => advance()}>
                    {index + 1 === receipt.cards.length
                      ? "Collection summary"
                      : "Reveal next"}
                  </button>
                  <button type="button" onClick={() => props.onViewCard(card)}>
                    View card
                  </button>
                </div>
                <Link
                  className="pack-secondary"
                  href={props.collectionHref ?? "/fantasy/cards"}
                  onClick={props.onClose}
                >
                  View collection
                </Link>
                {props.teamHref !== null && (
                  <Link
                    className="pack-secondary"
                    href={props.teamHref ?? "/fantasy/play"}
                    onClick={props.onClose}
                  >
                    Build team
                  </Link>
                )}
                {receipt.cards.length > 1 && (
                  <button
                    type="button"
                    className="pack-secondary"
                    onClick={() => advance(true)}
                  >
                    Reveal all
                  </button>
                )}
              </>
            )}
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
              {receipt.cards.length} confirmed{" "}
              {receipt.cards.length === 1 ? "card" : "cards"}.{" "}
              {receipt.cards.some((c) => c.rarity_version)
                ? "Lifetime test cards. Multipliers apply only in competitions declaring the new rarity rules; the current free round is unchanged."
                : props.teamHref === null
                  ? "Test cards have no cash value and do not enter scored teams."
                  : "All tiers score equally."}
            </p>
            <ul className="pack-summary">
              {receipt.cards.map((c) => (
                <li key={c.id}>
                  <span
                    className={`pack-position tier-${c.tier.toLowerCase()}`}
                  >
                    {c.position}
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.team} · {rarityRule(c.tier).label} · #{c.serial}
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
