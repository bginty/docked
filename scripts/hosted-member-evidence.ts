import { writeFileSync } from "node:fs";
import { hostedGoogleCall } from "./hosted-google-client";
async function main() {
  if (process.env.DOCKED_HOSTED_MEMBER_ACCEPTANCE !== "true")
    throw Error("Member test scope required");
  const label = process.argv[2];
  if (!/^[a-z0-9-]{1,60}$/.test(label ?? ""))
    throw Error("Evidence label required");
  const s = await hostedGoogleCall({ operation: "status" });
  const e = {
    at: new Date().toISOString(),
    backend: s.backend,
    member: s.member,
    balance: s.balance,
    spendable: s.spendable,
    packProducts: s.packProducts.map((p: any) => ({
      sport: p.sport,
      family: p.type,
      count: p.cards,
      price: p.priceCredits,
    })),
    packs: s.packs,
    collection: s.collection.map((c: any) => ({
      id: c.id,
      name: c.name,
      sport: c.sport,
      rarity: c.tier,
      serial: c.serial,
    })),
    receipts: s.receipts,
    customerWallet: false,
    permanentInventory: false,
  };
  writeFileSync(
    `docs/qa/hosted-member-20261101/${label}.json`,
    JSON.stringify(e, null, 2),
  );
  console.log(
    JSON.stringify({
      label,
      balance: e.balance,
      spendable: e.spendable,
      packs: e.packs.length,
      cards: e.collection.length,
      receipts: e.receipts.map((r: any) => ({
        key: r.key.slice(0, 8),
        state: r.state,
      })),
    }),
  );
}
void main().catch(() => {
  console.error("Evidence not confirmed; secrets redacted");
  process.exitCode = 1;
});
