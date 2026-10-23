import type { SandboxCard } from "./sport-sandbox";
import type { AwardedCard } from "./pack-opening";
/** One presentation projection for collection, picker and historical details. */
export function sandboxCardView(
  c: SandboxCard,
): AwardedCard & { canonical_player_id?: string } {
  return {
    ...c,
    edition_id: `fixture:${c.player_id}:${c.tier}`,
    player_id: c.canonical_player_id ?? c.player_id,
    season: c.season ?? "BETA INVENTORY",
    kind: "regular",
    max_supply: c.max_supply ?? 0,
    serial: c.serial ?? 0,
    team: c.team ?? "",
    colour: c.colour ?? "",
    shirt: 0,
    tradeable: c.inventory_source === "credits-fixture-v1",
  };
}
