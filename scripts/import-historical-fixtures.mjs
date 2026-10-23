import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const service =
  process.argv[2] || "C:/Users/61412/Documents/ChatGPT/docked-nfl-ingestion";
await fs.mkdir("config/history", { recursive: true });
for (const sport of ["afl", "nrl"]) {
  const raw = JSON.parse(
    await fs.readFile(
      path.join(service, `evidence/${sport}-2026-history.json`),
      "utf8",
    ),
  );
  assert.equal(raw.schema_version, "docked-historical-fixtures-v1");
  assert.equal(raw.sport, sport);
  assert.equal(raw.synthetic, false);
  assert.equal(raw.player_games, 0);
  assert.equal(new Set(raw.games.map((g) => g.id)).size, raw.games.length);
  assert(
    raw.games.every(
      (g) =>
        g.sport === sport &&
        g.season === "2026" &&
        g.status === "final" &&
        Number.isInteger(g.home_score) &&
        Number.isInteger(g.away_score) &&
        g.provenance?.startsWith("https://"),
    ),
  );
  // Versioned publication of the service's existing fixture read model. This
  // does not write to competition, ownership, wallet or scoring tables.
  await fs.writeFile(
    `config/history/${sport}-2026.json`,
    JSON.stringify(raw) + "\n",
  );
  console.log(
    JSON.stringify({ sport, games: raw.games.length, playerGames: 0 }),
  );
}
