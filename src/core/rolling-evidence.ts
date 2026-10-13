import { digest, type ScoringState } from "./scoring-engine";
/** Only the trusted DB lock bridge can append rolling entries. Old locked slots never change. */
export function assertRollingEvidence(old: ScoringState, next: ScoringState) {
  if (
    !old.period.lineupVersion ||
    next.audits.at(-1)?.action !== "rolling-lineups-synchronised"
  )
    throw Error("Locked entries immutable");
  if (
    old.lineupsLockedAt &&
    (old.entries.length !== next.entries.length ||
      old.entries.some((e) => !next.entries.some((n) => n.member === e.member)))
  )
    throw Error("Entry membership frozen at first kickoff");
  for (const entry of old.entries)
    for (const card of entry.cards) {
      const replacement = next.entries
        .find((e) => e.member === entry.member)
        ?.cards.find((c) => c.slot === card.slot);
      if (card.slotLockedAt && digest(card) !== digest(replacement))
        throw Error("Locked slot evidence changed");
    }
  for (const entry of next.entries) {
    if (
      new Set(entry.cards.map((c) => c.slot)).size !==
      next.period.rules.slots.length
    )
      throw Error("Invalid rolling slot assignments");
    for (const card of entry.cards) {
      const slot = next.period.rules.slots.find((s) => s.id === card.slot);
      const fixture = next.period.fixtures.find(
        (f) => f.id === card.fixtureId && f.playerIds.includes(card.playerId),
      );
      if (
        !slot?.positions.includes(card.position) ||
        !fixture ||
        (card.slotLockedAt &&
          Date.parse(card.slotLockedAt) !== Date.parse(fixture.scheduledAt))
      )
        throw Error("Rolling fixture or position mismatch");
    }
  }
}
