import type { FantasyState } from "./fantasy";

/** Confirmation means an accepted entry, not preview/apply or saving a draft. */
export function hasEstablishedTeam(
  data: FantasyState,
  sport: string,
  mode: string,
) {
  if (data.seven?.established?.[`${sport}:${mode}`]) return true;
  // Existing entries also protect clients upgrading from an older read projection.
  return !!data.seven?.entries.some((e) =>
    data.competitions.some(
      (c) =>
        c.id === e.competition_id &&
        (c.sport ?? "nfl") === sport &&
        c.rules.mode === mode,
    ),
  );
}
