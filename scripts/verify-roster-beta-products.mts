/** Read actual deployed configuration, then simulate allocation only in memory. No purchase or mutation. */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  allocateNine,
  eligibleCatalogue,
  type CardEconomy,
} from "../src/core/card-economy";
import { packAvailability } from "../src/core/pack-availability";
import { isRosterBetaPlayer } from "../src/core/roster-beta";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(projectRef, "pojoymtniryarxxunyvz");
const sql = ownerDatabase();
try {
  const economy = await sql.begin(
    "read only",
    async (tx) =>
      (
        await tx`select document->'economy' economy from credits_sandbox.state where id`
      )[0].economy as CardEconomy,
  );
  const now = Date.now(),
    before = JSON.stringify(economy),
    products = [];
  for (const id of economy.activeProductVersions ?? []) {
    const p = economy.products[id];
    if (p.inventoryScope !== "real-roster-beta-v1") continue;
    const availability = packAvailability(economy, p, now);
    assert(availability.available, availability.availabilityReason ?? id);
    const copy = structuredClone(economy),
      pack = allocateNine(
        copy,
        id,
        "isolated-read-only-verification",
        "offline-" + id,
        now,
        () => 0,
      );
    assert.equal(pack.cards.length, 9);
    assert(
      pack.cards.every(
        (c) =>
          copy.instances[c].rarity !== "CORE" &&
          isRosterBetaPlayer(copy.players[copy.instances[c].playerId]),
      ),
    );
    products.push({
      sport: p.sport,
      id,
      price: p.priceCredits,
      eligiblePlayers: eligibleCatalogue(economy, p, now).length,
      available: true,
      offlineAllocationCards: pack.cards.length,
    });
  }
  assert.equal(products.length, 6);
  assert.equal(JSON.stringify(economy), before);
  const receipt = {
    at: new Date().toISOString(),
    projectRef,
    actualHostedConfiguration: true,
    databaseMode: "read only",
    allocationMode: "memory only; no hosted purchase or member session",
    products,
    passed: true,
  };
  await fs.writeFile(
    root + "/docs/qa/real-rosters/release/products.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(receipt);
} finally {
  await sql.end({ timeout: 3 });
}
