"use client";
import { useCallback, useEffect, useState } from "react";
import { FantasySheet } from "./fantasy-player-sheet";
import { SocialComposer } from "./social-composer";
/** A convenience draft only. No transaction metadata or automatic publishing. */
export function AcquisitionShare({
  member,
  reference,
  cards,
}: {
  member: string;
  reference: string;
  cards: { id: string; name: string; tier?: string }[];
}) {
  const key = `docked:share-dismissed:v1:${member}:${reference}`;
  const [dismissed, setDismissed] = useState(true),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState(cards[0]?.id ?? "");
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {}
  };
  const close = useCallback(() => setOpen(false), []);
  const card = cards.find((c) => c.id === selected) ?? cards[0];
  if (!card) return null;
  return (
    <>
      {!dismissed && (
        <div className="share-prompt">
          {cards.length > 1 && (
            <label>
              Choose a card to share
              <select
                value={card.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => {
              dismiss();
              setOpen(true);
            }}
          >
            Share your new card
          </button>
          <button type="button" onClick={dismiss}>
            Not now
          </button>
        </div>
      )}
      {open && (
        <FantasySheet title="Share your card" onClose={close}>
          <p>Review your post. Nothing is shared until you press Post.</p>
          <SocialComposer
            initialSport="nfl"
            inline
            initialCardIds={[card.id]}
            onPublished={close}
            onCancel={close}
            initialBody={`Added ${card.name}${card.tier ? ` (${card.tier.replaceAll("_", " ")})` : ""} to my Docked collection.`}
          />
        </FantasySheet>
      )}
    </>
  );
}
