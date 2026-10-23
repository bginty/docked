import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { testCard } from "../src/core/member-test-wallet";
import type { RawCard } from "../src/server/owned-collection";
import type { CollectionPage } from "../src/core/owned-collection";
const root = process.cwd(),
  out = root + "/docs/qa/owned-collection/release";
const file = "20261023022240_owned_collection_read.sql",
  body = await fs.readFile(root + "/supabase/migrations/" + file, "utf8");
const hash = createHash("sha256").update(body).digest("hex"),
  mode = process.argv[2];
assert(["rehearse", "apply", "verify", "measure"].includes(mode));
assert.equal(projectRef, "pojoymtniryarxxunyvz");
await fs.mkdir(out, { recursive: true });
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
try {
  if (mode === "measure") {
    // Owner diagnostic SELECT over the exact query body. This does NOT create a user
    // session or claim authenticated API/browser acceptance. No auth control is changed.
    const query = body
      .slice(body.indexOf("with ledger"), body.indexOf(" return result;"))
      .trim()
      .replace(/into result from summary s;/, "from summary s")
      .replace(/\bsport_id\b/g, "($2::jsonb->>'sport')")
      .replace(/\bu\b/g, "$1::uuid")
      .replace(/\bf\b/g, "($2::jsonb)");
    await fs.writeFile(root + "/tmp/collection-measure-query.sql", query);
    const accounts =
      await sql`select user_id,label from credits_sandbox.access where enabled and label in('Owner','Barry','Luke','Brenton') order by label`;
    const rows = [];
    let plan;
    for (const a of accounts)
      for (const sport of ["nfl", "basketball", "afl", "nrl"]) {
        const times = [];
        let result!: CollectionPage & { rows: RawCard[] };
        for (let i = 0; i < 3; i++) {
          const start = performance.now();
          result = Object.values(
            (await sql.unsafe(query, [a.user_id, { sport }]))[0],
          )[0] as typeof result;
          times.push(performance.now() - start);
        }
        const cards = result.rows.map((r) =>
          r.inventory === "collectible"
            ? r.card
            : testCard(
                {
                  commerce: { cards: { [r.id]: r.commerce } },
                  cards: { [r.id]: true },
                  ...(r.instance && r.player
                    ? {
                        economy: {
                          instances: { [r.id]: r.instance },
                          players: { [r.instance.playerId]: r.player },
                        },
                      }
                    : {}),
                },
                r.id,
              ),
        );
        const independent =
          await sql`with credits as (select c.key id,c.value->>'tier' tier from credits_sandbox.state s cross join lateral jsonb_each(s.document->'commerce'->'cards')c where s.id and c.value->>'owner'=${a.user_id} and c.value->>'sport'=${sport} and s.document->'cards' ? c.key and (s.document->'economy'->'instances'->c.key->>'source' is null or s.document->'entitlements'->(s.document->'economy'->'instances'->c.key->>'source')->>'status'='OPENED')),legacy as(select c.id::text,e.tier from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players p on p.id=e.player_id where c.owner_id=${a.user_id} and p.sport=${sport} and not exists(select 1 from beta_fantasy.pack_items pi join beta_fantasy.packs p on p.id=pi.pack_id where pi.card_id=c.id and p.opened_at is null) and not exists(select 1 from credits_sandbox.state s where s.document->'commerce'->'cards' ? c.id::text)),owned as(select * from credits union all select * from legacy) select tier,count(*)::int count from owned group by tier`;
        assert.deepEqual(
          result.counts,
          Object.fromEntries(independent.map((r) => [r.tier, r.count])),
        );
        rows.push({
          account: a.label,
          sport,
          total: result.total,
          counts: result.counts,
          pageCards: cards.length,
          estimatedPreviewBytes: Buffer.byteLength(
            JSON.stringify({ ...result, cards, rows: undefined }),
          ),
          databaseResponseBytes: Buffer.byteLength(JSON.stringify(result)),
          readMs: times,
        });
        if (a.label === "Owner" && sport === "nfl")
          plan = await sql.unsafe(
            "explain (analyze,buffers,format json) " + query,
            [a.user_id, { sport }],
          );
      }
    await fs.writeFile(
      out + "/performance.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          scope:
            "Read-only owner diagnostics against live records, not authenticated browser/API",
          sizeMethod:
            "databaseResponseBytes is the actual SQL JSON response; estimatedPreviewBytes is the card projection before API member/cursor metadata and jersey hydration. It is not measured HTTP transfer size.",
          rows,
          plan,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(rows));
  } else {
    if (mode === "apply") {
      const proof = JSON.parse(
        await fs.readFile(out + "/database-rehearse.json", "utf8"),
      );
      assert(proof.passed && proof.hash === hash);
    }
    let receipt: unknown;
    try {
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout='5s'`;
        await tx`set local statement_timeout='60s'`;
        const snapshot = async () => {
          const data: Record<string, unknown> = {};
          for (const table of [
            "credits_sandbox.state",
            "beta_fantasy.cards",
            "beta_fantasy.ownership_events",
            "beta_fantasy.entries",
            "beta_fantasy.results",
            "beta_fantasy.competitions",
            "beta_fantasy.sales",
            "beta_fantasy.packs",
            "sports_feed.sport_sandbox_inventory",
            "sports_feed.nfl_control",
          ])
            data[table] = (
              await tx.unsafe(
                `select count(*) count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
              )
            )[0];
          return data;
        };
        const before = await snapshot();
        if (mode === "apply") {
          await fs.mkdir("private-data/owned-collection", { recursive: true });
          await fs.writeFile(
            "private-data/owned-collection/preimage-" + Date.now() + ".json",
            JSON.stringify({
              hash,
              before,
              rollback:
                "Promote prior application. Additive read function may remain unused; no data rollback required.",
            }),
            { flag: "wx", mode: 0o600 },
          );
        }
        if (mode !== "verify") await tx.unsafe(body);
        if (mode === "rehearse") await tx.unsafe(body);
        for (const role of [
          "anon",
          "authenticated",
          "service_role",
          "docked_app",
        ])
          assert.equal(
            (
              await tx`select has_function_privilege(${role},'beta_fantasy.owned_collection_page(jsonb)','execute') ok`
            )[0].ok,
            false,
          );
        assert.equal(
          (
            await tx`select has_function_privilege('docked_beta_app','beta_fantasy.owned_collection_page(jsonb)','execute') ok`
          )[0].ok,
          true,
        );
        assert.deepEqual(await snapshot(), before, "Protected data changed");
        if (mode === "apply")
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values('20261023022240','owned_collection_read',${[body]}) on conflict do nothing`;
        receipt = {
          passed: true,
          mode,
          hash,
          at: new Date().toISOString(),
          projectRef,
          protectedRecords: before,
          ownershipWrites: 0,
          walletWrites: 0,
          rollback:
            "Prior application remains compatible; keep the additive read function unused.",
        };
        if (mode === "rehearse") throw Error("ROLLBACK_REHEARSAL");
      });
    } catch (e) {
      if (!(
        mode === "rehearse" &&
        e instanceof Error &&
        e.message === "ROLLBACK_REHEARSAL"
      ))
        throw e;
    }
    await fs.writeFile(
      out + `/database-${mode}.json`,
      JSON.stringify(receipt, null, 2),
    );
    console.log(JSON.stringify({ passed: true, mode, hash }));
  }
} finally {
  await sql.end();
}
