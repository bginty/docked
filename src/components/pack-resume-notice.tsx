"use client";
import { useEffect, useState } from "react";
import {
  parseRevealProgress,
  revealProgressEvent,
  revealProgressKey,
} from "@/core/pack-reveal-progress";

type ResumePack = {
  id: string;
  name: string;
  status: string;
  cardCount?: number | null;
  receipt?: { cards: unknown[] } | null;
};
/** A device-local shortcut. The normal authenticated pack reader still supplies every card. */
export function PackResumeNotice({
  member,
  packs,
  disabled,
  onResume,
}: {
  member: string;
  packs: ResumePack[];
  disabled?: boolean;
  onResume: (id: string) => void;
}) {
  const [pending, setPending] = useState<{
    id: string;
    name: string;
    index: number;
    count: number;
  } | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const candidates = packs
          .flatMap((pack) => {
            const count = pack.receipt?.cards.length ?? pack.cardCount ?? 0;
            if (pack.status !== "OPENED" || !count) return [];
            const progress = parseRevealProgress(
              localStorage.getItem(revealProgressKey(member, pack)),
              count,
            );
            return progress && progress.index < count
              ? [{ id: pack.id, name: pack.name, count, ...progress }]
              : [];
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setPending(candidates[0] ?? null);
      } catch {
        setPending(null);
      }
    };
    read();
    window.addEventListener(revealProgressEvent, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(revealProgressEvent, read);
      window.removeEventListener("storage", read);
    };
  }, [member, packs]);
  if (!pending) return null;
  return (
    <aside className="pack-resume-notice" aria-label="Unfinished pack reveal">
      <div>
        <strong>Continue your pack</strong>
        <p>
          {pending.name} · Card {pending.index + 1} of {pending.count}
        </p>
        <small>Uses your saved result. No new cards or credit charge.</small>
      </div>
      <button
        type="button"
        className="pack-control pack-primary"
        disabled={disabled}
        onClick={() => onResume(pending.id)}
      >
        Resume Pack
      </button>
    </aside>
  );
}
