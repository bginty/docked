/** Read-only revenue-launch census. Never calls a payment, SMS or mutating RPC. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import {
  custodyQuery,
  validateReviewedInventory,
} from "./lib/reviewed-inventory";
import {
  commercialPack,
  commercialSports,
} from "../src/core/commercial-billing";
import { hasRequiredPackSupply } from "../src/core/commercial-pack-supply";

async function main() {
  const output = process.argv[2];
  assert(
    output &&
      path.resolve(output).startsWith(path.resolve("docs/qa") + path.sep),
  );
  const planBytes = readFileSync(
    "private-data/v31-card-research-20261111/complete-proposal.private.json",
  );
  const planSha256 = createHash("sha256").update(planBytes).digest("hex");
  assert.equal(
    planSha256,
    "4b039916c4ef00698e10bfa9d14c41ce23b9febf06cf78e035ae595a08dd3ee4",
  );
  const plan = JSON.parse(planBytes.toString("utf8"));
  validateReviewedInventory(plan);
  const eligibility = JSON.parse(
    readFileSync(
      "docs/qa/v31-prelaunch-20261111/cards/current-eligibility.NOT-APPROVED.json",
      "utf8",
    ),
  );
  const selected = new Set<string>(eligibility.proposedDefinitionIds);
  assert.equal(selected.size, 6065);
  assert.equal(
    digest([...selected].sort()),
    "1956d1715dcd2ef494dad469f8b272951853d5d76773fe9ae39f5537996e6830",
  );
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const data = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='45s'`;
        const [{ value: custody }] = await tx.unsafe(custodyQuery);
        assert.equal(digest(custody), plan.protectedCustodyDigest);
        const definitions =
          await tx`select * from commercial_billing.definitions order by id`;
        assert.equal(
          digest(definitions),
          digest([...plan.rows].sort((a, b) => a.id.localeCompare(b.id))),
        );
        const [commercial] = await tx`select
        (select count(*)::int from commercial_billing.definitions) definitions,
        (select coalesce(sum(legacy_issued),0)::int from commercial_billing.definitions) legacy_issued,
        (select count(*)::int from commercial_billing.definitions where approved) approved,
        (select count(*)::int from commercial_billing.cards) cards,
        (select count(*)::int from commercial_billing.packs) packs,
        (select count(*)::int from commercial_billing.receipts) receipts,
        (select count(*)::int from commercial_billing.accounts) accounts,
        (select count(*)::int from commercial_billing.products where approved) approved_products,
        (select to_jsonb(c) from commercial_billing.control c where id) controls`;
        assert.equal(commercial.approved, 0);
        for (const field of [
          "sales_enabled",
          "issuance_enabled",
          "transfers_enabled",
          "gameplay_enabled",
        ])
          assert.equal(commercial.controls[field], false);
        const [preserved] =
          await tx`with s as(select document d from credits_sandbox.state where id),
        owned as(select e.key,e.value instance,s.d#>array['commerce','cards',e.key] custody,
          s.d#>array['cards',e.key] ownership,s.d#>array['entitlements',e.value->>'source'] entitlement
          from s,jsonb_each(s.d#>'{economy,instances}') e)
        select count(*)::int active_instances,
          count(*)filter(where custody->>'owner' is not null)::int with_current_owner,
          count(*)filter(where custody->>'owner' is not null and ownership is not null and
            (instance->>'source' is null or entitlement->>'status'='OPENED'))::int current_visible_beta_instances,
          count(*)filter(where instance->>'rarity'='CORE')::int core,
          count(*)filter(where instance->>'rarity'<>'CORE')::int limited from owned`;
        const notifications =
          await tx`select to_jsonb(n) value from credits_sandbox.store_notifications n where state='attention' order by id`;
        const audit =
          await tx`select t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition
        from pg_trigger t where t.tgrelid='private.audit_events'::regclass and not t.tgisinternal order by t.tgname`;
        const supply = commercialSports.flatMap((sport) =>
          ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"].map(
            (rarity) => ({
              sport,
              rarity,
              players: new Set(
                definitions
                  .filter(
                    (r) =>
                      selected.has(r.id) &&
                      r.sport === sport &&
                      r.rarity === rarity &&
                      r.issued < r.lifetime_cap,
                  )
                  .map((r) => r.player_id),
              ).size,
            }),
          ),
        );
        const products = commercialSports.flatMap((sport) =>
          (["STANDARD", "PREMIUM"] as const).flatMap((family) =>
            ([1, 3, 9] as const).map((size) => {
              const p = commercialPack(sport, family, size);
              return {
                id: p.id,
                cards: p.cards,
                priceCredits: p.priceCredits,
                configurationHash: p.configurationHash,
                capacitySufficientIfSeparatelyApproved: hasRequiredPackSupply(
                  p,
                  supply.filter((r) => r.sport === sport),
                ),
                availableForSale: false,
              };
            }),
          ),
        );
        return {
          commercial,
          preserved,
          custodyRecords: custody.length,
          custodyDigest: digest(custody),
          supply,
          products,
          notifications: notifications.map((n) => n.value),
          audit,
        };
      },
    );
    const privateDir = "private-data/v31-revenue-launch-20261113";
    mkdirSync(privateDir, { recursive: true });
    const notificationBytes = Buffer.from(
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          projectRef: "pojoymtniryarxxunyvz",
          rows: data.notifications,
        },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(
      `${privateDir}/historical-notifications.private.json`,
      notificationBytes,
      { flag: "wx" },
    );
    const { notifications, ...safe } = data;
    const report = {
      at: new Date().toISOString(),
      productionWrites: 0,
      planSha256,
      ...safe,
      historicalNotifications: {
        attention: notifications.length,
        attempts: notifications.map((r) => r.attempts),
        manifestSha256: createHash("sha256")
          .update(notificationBytes)
          .digest("hex"),
      },
      limits: [
        "No founder impersonation",
        "No hosted purchase or SMS",
        "Capacity is not rights approval",
        "Commercial collection excludes existing beta custody until repaired",
      ],
    };
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Read-only audit failed");
  process.exitCode = 1;
});
