import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
import { commercialPack } from "../../src/core/commercial-billing";
import { rarityConfiguration } from "../../src/core/card-rarity";

for (const sport of [aflConfiguration, nrlConfiguration])
  test(`${sport.label}: commercial owned inventory reuses saved lineup validation without changing other rounds`, async () => {
    const d = await multiSportDatabase(sport, false, undefined, true, true);
    try {
      await d.pg.exec(
        await readFile(
          "supabase/migrations/20261102010000_commercial_lineup_inventory.sql",
          "utf8",
        ),
      );
      const cid = d.rounds.OPEN1,
        old = d.inventories[d.user];
      const before = await d.q(
        "select rules from beta_fantasy.competitions where id=$1",
        [d.rounds.OPEN3],
      );
      for (const c of old) {
        await d.q(
          "insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season) values($1,$2,$3,$4,$5,'#1759a3',1,'2099')",
          [c.player_id, c.name, sport.id, c.position, c.team],
        );
        await d.q(
          "insert into sports_feed.free_core_roster values($1,$2,'2099',$3,'2099-03-01','https://example.invalid/isolated-roster',$4,true)",
          [
            c.player_id,
            sport.id,
            JSON.stringify(c.eligible_positions),
            "a".repeat(64),
          ],
        );
      }
      await d.q(
        "update sports_feed.free_core_programmes set enabled=true where sport=$1",
        [sport.id],
      );
      assert.deepEqual(
        (
          await d.q("select sports_feed.lineup_inventory($1,$2) cards", [
            d.user,
            cid,
          ])
        )[0].cards,
        [],
      );
      await d.q(
        "update commercial_billing.control set gameplay_enabled=true,policy_version='commercial-closed-loop-2026-11-01-v1',approvals='{\"validUntil\":\"2099-03-01T00:00:00Z\"}'",
      );
      await d.q(
        "insert into credits_sandbox.rarity_configuration values($1,$2) on conflict do nothing",
        [rarityConfiguration.version, JSON.stringify(rarityConfiguration)],
      );
      await d.q(
        "insert into commercial_billing.accounts(member_id) values($1),($2)",
        [d.user, d.other],
      );
      const definition = randomUUID(),
        pack = randomUUID(),
        card = randomUUID();
      await d.q(
        "insert into commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values($1,$2,$3,'RARE',5000,true,'isolated fixture','{}')",
        [definition, old[0].player_id, sport.id],
      );
      await d.q(
        "insert into commercial_billing.packs(id,member_id,request,product,price,funding,draw_evidence,policy_version,opened_at) values($1,$2,$3,$4,100,'[]','[]','isolated fixture',clock_timestamp())",
        [
          pack,
          d.user,
          randomUUID(),
          JSON.stringify(
            commercialPack(sport.id as "afl" | "nrl", "STANDARD", 1),
          ),
        ],
      );
      await d.q(
        "insert into commercial_billing.cards(id,definition,serial,owner_id,pack,slot) values($1,$2,1,$3,$4,0)",
        [card, definition, d.user, pack],
      );
      const state = await d.state();
      const owned = state.cards.find((c: any) => c.id === card);
      assert.equal(owned.multiplierTenths, 11);
      const record = (
        await d.q("select commercial_billing.member_record($1) r", [sport.id])
      )[0].r;
      assert.equal(record.total, 1);
      assert.equal(record.counts.RARE, 1);
      assert.equal(record.opened, 1);
      assert.deepEqual(owned.eligible_competition_ids, [cid]);
      const picks = sandboxRecommendation(state, cid).picks;
      const slot = sport.slots.find((s) =>
        s.positions.includes(old[0].position),
      )!;
      const matching = picks.find(
        (p: any) =>
          state.cards.find((c: any) => c.id === p.card)?.player_id ===
          old[0].player_id,
      );
      const chosen = picks.map((p: any) =>
        p.slot === (matching?.slot ?? slot.id) ? { ...p, card } : p,
      );
      await d.command("seven_draft", cid, chosen, 0);
      await d.command("seven_enter", cid, chosen, 0);
      const entry = (await d.state()).entries.find(
        (e: any) => e.competition_id === cid,
      );
      assert.equal(entry.snapshot.length, sport.slots.length);
      assert.equal(
        entry.snapshot.find((c: any) => c.card_id === card).multiplierTenths,
        11,
      );
      await assert.rejects(
        d.q("update commercial_billing.cards set owner_id=$1 where id=$2", [
          d.other,
          card,
        ]),
        /reserved/,
      );
      await assert.rejects(
        d.q(
          "insert into commercial_billing.listings(card,seller,price)values($1,$2,100)",
          [card, d.user],
        ),
        /reserved/,
      );
      await assert.rejects(d.command("seven_enter", d.rounds.OPEN2, chosen, 0));
      await d.asUser(d.other);
      const theirs = (
        await d.q("select commercial_billing.lineup_inventory($1,$2) cards", [
          d.user,
          cid,
        ])
      )[0].cards;
      assert.deepEqual(theirs, []);
      await d.asUser(d.user);
      await d.command("seven_withdraw", cid, [], entry.revision ?? 1);
      await d.q("update commercial_billing.cards set owner_id=$1 where id=$2", [
        d.other,
        card,
      ]);
      assert.ok(!(await d.state()).cards.some((c: any) => c.id === card));
      assert.equal(
        (
          await d.q("select commercial_billing.member_record($1) r", [sport.id])
        )[0].r.total,
        0,
      );
      assert.deepEqual(
        await d.q("select rules from beta_fantasy.competitions where id=$1", [
          d.rounds.OPEN3,
        ]),
        before,
      );
      assert.equal(
        (
          await d.q(
            "select count(*)::int n from beta_fantasy.cards where owner_id=$1",
            [d.user],
          )
        )[0].n,
        0,
      );
    } finally {
      await d.pg.close();
    }
  });
