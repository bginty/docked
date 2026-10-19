// The canonical view exposes text IDs, including legacy non-UUID player IDs.
export const playerJerseysQuery =
  "select id,team,verified_jersey_number from credits_sandbox.current_player_jerseys where id=any($1::text[])";
