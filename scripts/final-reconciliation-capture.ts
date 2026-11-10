/** Exact Production read-only snapshot. Never writes hosted data or prints owners. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";

assert.equal(process.argv[2], "--production-read-only");
const root = process.cwd();
const dir = "private-data/v31-final-reconciliation-20261110";
mkdirSync(dir, { recursive: true, mode: 0o700 });
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const data = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [state] =
          await tx`select revision,document from credits_sandbox.state where id`;
        const nfl =
          await tx`select id,document from credits_sandbox.card_instances order by id`;
        const fixtures =
          await tx`select id,document from credits_sandbox.nba_fixture_instances order by id`;
        const receipts =
          await tx`select id,document from credits_sandbox.pack_receipts order by id`;
        const players =
          await tx`select id,sport,provider,provider_id,identity from credits_sandbox.permanent_players`;
        const evidence =
          await tx`select r.player_id,r.provider_id,r.team,r.position,r.status,r.identity_verified,r.source_url,r.source_hash,r.checked_at,p.id catalogue_id,p.name catalogue_name,p.status catalogue_status,p.position catalogue_position from nfl_roster.current_evidence r left join beta_fantasy.players p on p.id::text=r.player_id order by r.provider_id,r.player_id`;
        const [gates] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,(select count(*)::int from commercial_billing.definitions) definitions,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.receipts) receipts from commercial_billing.control where id`;
        assert(
          gates &&
            !gates.sales_enabled &&
            !gates.issuance_enabled &&
            !gates.transfers_enabled,
        );
        assert.equal(gates.definitions, 0);
        assert.equal(gates.cards, 0);
        const d = state.document,
          e = d.economy;
        const all = new Map<
          string,
          { doc: any; locations: string[]; mirrors: any[] }
        >();
        for (const [loc, rows] of [
          ["active", Object.entries(e.instances)],
          ["retired", Object.entries(e.retiredTestInstances ?? {})],
          ["registry_nfl", nfl.map((r) => [r.id, r.document])],
          ["registry_fixture", fixtures.map((r) => [r.id, r.document])],
        ] as [string, any[]][])
          for (const [id, doc] of rows) {
            const prior = all.get(id);
            if (prior) {
              prior.locations.push(loc);
              prior.mirrors.push(doc);
            } else all.set(id, { doc, locations: [loc], mirrors: [doc] });
          }
        const receiptMap = new Map(receipts.map((r) => [r.id, r.document]));
        const records = [...all].map(([id, r]) => {
          const p =
            e.players[r.doc.playerId] ??
            players.find((p) => p.id === r.doc.playerId)?.identity;
          const receipt = receiptMap.get(r.doc.source) ?? e.packs[r.doc.source];
          const c = d.commerce?.cards?.[id];
          const h = d.cards?.[id];
          return {
            id,
            ...r,
            player: p ?? null,
            receipt: receipt
              ? {
                  id: receipt.id,
                  createdAt: receipt.createdAt,
                  member: receipt.member,
                  product: receipt.product,
                  cards: receipt.cards,
                }
              : null,
            custody: c ?? null,
            ownership: h ?? null,
            listings: Object.values(d.listings ?? {}).filter(
              (x: any) => x.card === id || x.cardId === id,
            ),
          };
        });
        // Do not persist state, balances, unrelated events, auth records or tokens.
        return {
          capturedAt: new Date().toISOString(),
          project: "pojoymtniryarxxunyvz",
          readOnly: true,
          revision: state.revision,
          gates,
          records,
          evidence,
        };
      },
    );
    const file = dir + "/census.private.json";
    const bytes = JSON.stringify(data, null, 2) + "\n";
    writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
    const prior = JSON.parse(
      readFileSync(
        "docs/qa/v31-p1-p4-20261110/issued-reconciliation.json",
        "utf8",
      ),
    );
    console.log(
      JSON.stringify({
        capturedAt: data.capturedAt,
        records: data.records.length,
        priorGroups: prior.rows.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        productionWrites: 0,
        gates: data.gates,
      }),
    );
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error(
    "Read-only reconciliation capture failed; no hosted mutation permitted.",
  );
  process.exitCode = 1;
});
