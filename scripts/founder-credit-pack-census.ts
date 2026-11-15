/** Read-only, bounded row reads. Join public catalogue facts locally, not against
 * the large live wallet JSON. No balances, customer rows or credentials exported. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
const out = "docs/qa/founder-credit-packs-20261115";
mkdirSync(out, { recursive: true });
const sha = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function main() {
  try {
    const data = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='15s'`;
        const [state] =
          await tx`select document#>'{economy,players}' players,document#>'{economy,definitions}' definitions,document#>'{economy,products}' products,document#>'{economy,activeProductVersions}' active from credits_sandbox.state where id`;
        const definitions =
          await tx`select id,player_id::text,sport,rarity,issued,legacy_issued,lifetime_cap,snapshot from commercial_billing.definitions order by id`;
        const members =
          await tx`select sport,season,player_id::text,provider,provider_id,rights_id,evidence_sha256 from season_catalogue.members where scope='free_weekly' order by sport,player_id`;
        const triggers =
          await tx`select tgrelid::regclass::text relation,tgname,pg_get_functiondef(tgfoid) definition from pg_trigger where tgrelid in('credits_sandbox.card_instances'::regclass,'credits_sandbox.nba_fixture_instances'::regclass) and not tgisinternal order by 1,2`;
        const [control] =
          await tx`select sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`;
        return {
          state,
          definitions: [...definitions],
          members: [...members],
          triggers: [...triggers],
          control,
        };
      },
    );
    assert(Object.values(data.control).every((v) => v === false));
    const legacy = new Map<string, any>();
    for (const [id, p] of Object.entries<any>(data.state.players)) {
      const key = [p.sport, p.provider, p.providerId].join("|");
      assert(!legacy.has(key), "Duplicate legacy provider identity");
      legacy.set(key, { id, ...p });
    }
    const definitions = new Map<string, any[]>();
    for (const d of data.definitions)
      definitions.set(d.player_id, [
        ...(definitions.get(d.player_id) ?? []),
        d,
      ]);
    const pool: any[] = [],
      held: any[] = [];
    const partition = JSON.parse(
      readFileSync(
        "docs/qa/v31-revenue-launch-20261113/cards/current-eligibility-delta.NOT-APPROVED.json",
        "utf8",
      ),
    );
    const permitted = new Set<string>(partition.proposedDefinitionIds);
    for (const m of data.members) {
      const p = legacy.get([m.sport, m.provider, m.provider_id].join("|"));
      const ds = definitions.get(m.player_id) ?? [];
      const reason = !p
        ? "no exact registered provider match"
        : ds.length !== 5
          ? "complete permanent definitions absent"
          : ds.some((d) => !permitted.has(d.id))
            ? "existing source exclusion or conservative hold retained"
            : ds.some(
                  (d) =>
                    d.issued !==
                    (data.state.definitions[`${p.id}:${d.rarity}`]?.issued ??
                      0),
                )
              ? "historical counter reconciliation required"
              : null;
      const row = {
        ...m,
        legacyPlayer: p?.id ?? null,
        definitions: ds.map((d) => ({
          id: d.id,
          rarity: d.rarity,
          issued: d.issued,
          cap: d.lifetime_cap,
        })),
      };
      if (reason) held.push({ ...row, reason });
      else pool.push(row);
    }
    const report = {
      at: new Date().toISOString(),
      productionWrites: 0,
      control: data.control,
      legacyPlayers: Object.keys(data.state.players).length,
      permanentDefinitions: data.definitions.length,
      pool: pool.length,
      bySport: Object.fromEntries(
        ["nfl", "afl", "nrl"].map((s) => [
          s,
          pool.filter((x) => x.sport === s).length,
        ]),
      ),
      held: held.length,
      poolDigest: sha(pool),
      heldDigest: sha(held),
      activeProducts: data.state.active.map((id: string) => ({
        id,
        sport: data.state.products[id].sport,
        cards: data.state.products[id].cards,
        price: data.state.products[id].priceCredits,
        expiresAt: data.state.products[id].expiresAt,
      })),
    };
    writeFileSync(out + "/census.json", JSON.stringify(report, null, 2) + "\n");
    writeFileSync(
      out + "/catalogue-candidates.json",
      JSON.stringify({ pool, held }, null, 2) + "\n",
    );
    writeFileSync(
      out + "/existing-instance-guards.json",
      JSON.stringify(data.triggers, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error
      ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[connection redacted]")
      : "Census stopped",
  );
  process.exitCode = 1;
});
