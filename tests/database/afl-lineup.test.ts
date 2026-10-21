import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
test("AFL 22: authoritative positions, independent modes/weeks, rollover, history and privacy", async () => {
  const db = await multiSportDatabase();
  const {
    q,
    user,
    other,
    inventories,
    rounds,
    config,
    command,
    state,
    asUser,
  } = db;
  try {
    const picks = config.slots.map((s, i) => ({
      slot: s.id,
      card: inventories[user][i].id,
    }));
    const cid = rounds.SALARY_CAP1;
    await q("select set_config('request.jwt.claims','{}',false)");
    await assert.rejects(state(), /Isolated sport access/);
    await assert.rejects(
      q("select sports_feed.sport_sandbox_command('seven_draft',$1,$2)", [
        JSON.stringify({ competition_id: cid, revision: 0, selections: [] }),
        randomUUID(),
      ]),
      /MFA/,
    );
    await asUser(user);
    assert.equal(
      (
        await q(
          "select has_function_privilege('docked_beta_app','sports_feed.sport_sandbox_command(text,jsonb,uuid)','EXECUTE') ok",
        )
      )[0].ok,
      true,
    );
    const originalCards = structuredClone(inventories[user]);
    await q(
      "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2",
      [
        JSON.stringify(originalCards.map((c) => ({ ...c, tier: "ICON" }))),
        user,
      ],
    );
    await assert.rejects(
      command("seven_enter", cid, picks, 0),
      /Salary cap exceeded/,
    );
    await q(
      "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2",
      [
        JSON.stringify(
          originalCards.map((c, i) => (i === 0 ? { ...c, sport: "nfl" } : c)),
        ),
        user,
      ],
    );
    await assert.rejects(
      command("seven_enter", cid, picks, 0),
      /eligible card/,
    );
    await q(
      "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2",
      [JSON.stringify(originalCards), user],
    );
    await assert.rejects(
      command("seven_enter", cid, picks.slice(0, 21), 0),
      /every configured slot/,
    );
    await assert.rejects(
      command(
        "seven_enter",
        cid,
        [{ ...picks[0], card: picks[6].card }, ...picks.slice(1)],
        0,
      ),
      /eligible card/,
    );
    await assert.rejects(
      command(
        "seven_enter",
        cid,
        [picks[0], { ...picks[1], card: picks[0].card }, ...picks.slice(2)],
        0,
      ),
      /one card/,
    );
    await assert.rejects(
      command(
        "seven_enter",
        cid,
        [{ ...picks[0], card: inventories[other][0].id }, ...picks.slice(1)],
        0,
      ),
      /eligible card/,
    );
    const req = randomUUID();
    // The real restricted web DB role can invoke the MFA/scope-bound wrapper.
    await q("set role docked_beta_app");
    try {
      const result = (
        await q(
          "select sports_feed.sport_sandbox_command('seven_enter',$1,$2) result",
          [
            JSON.stringify({
              competition_id: cid,
              revision: 0,
              selections: picks,
            }),
            req,
          ],
        )
      )[0].result;
      assert.equal(result.salary, 2200);
      assert.equal((await state()).entries[0].snapshot.length, 22);
      await assert.rejects(
        q("select * from sports_feed.sport_sandbox_inventory"),
        /permission denied/,
      );
    } finally {
      await q("reset role");
    }
    await command("seven_enter", cid, picks, 0, req);
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.entry_revisions"))[0]
        .n,
      1,
    );
    let view = await state();
    assert.equal(view.entries[0].snapshot.length, 22);
    assert.deepEqual(
      view.drafts.find((d: any) => d.competition_id === rounds.SALARY_CAP2)
        .selections,
      picks,
    );
    assert.equal(
      view.drafts.some((d: any) => d.competition_id === rounds.OPEN2),
      false,
    );
    assert.equal(view.continuity.established["afl:SALARY_CAP"], true);
    const future = picks.map((p, i) =>
      i === 0 ? { ...p, card: inventories[user][22].id } : p,
    );
    await command("seven_draft", rounds.SALARY_CAP2, future, 1);
    assert.deepEqual(
      (await state()).entries[0].snapshot.map((s: any) => ({
        slot: s.slot,
        card: s.card_id,
      })),
      picks,
    );
    await assert.rejects(
      command("seven_draft", rounds.SALARY_CAP2, picks, 1),
      /another window/,
    );
    // Actual second member; only own entries before lock.
    await asUser(other);
    const theirs = config.slots.map((s, i) => ({
      slot: s.id,
      card: inventories[other][i].id,
    }));
    await command("seven_enter", cid, theirs, 0);
    assert.equal((await state()).entries.length, 1);
    await q("select set_config('qa.now','2099-02-01T00:00:01Z',false)");
    view = await state();
    assert.equal(view.entries.length, 2);
    assert.equal(
      view.entries.find((e: any) => e.user_id === user).snapshot.length,
      22,
    );
    assert.equal(
      view.drafts.some((d: any) =>
        d.selections.some((s: any) => s.card === picks[0].card),
      ),
      false,
    );
    await asUser(user);
    await assert.rejects(command("seven_enter", cid, future, 1), /closed/);
    // Removal from current inventory cannot rewrite locked history.
    await q(
      "update sports_feed.sport_sandbox_inventory set cards='[]' where user_id=$1",
      [user],
    );
    assert.deepEqual(
      (await state()).entries
        .find((e: any) => e.user_id === user)
        .snapshot.map((s: any) => ({ slot: s.slot, card: s.card_id })),
      picks,
    );
    // Untrusted client role has neither tables nor private command access.
    assert.equal(
      (
        await q(
          "select has_table_privilege('authenticated','sports_feed.sport_sandbox_inventory','SELECT') ok",
        )
      )[0].ok,
      false,
    );
    await q("select set_config('docked.multi_sport','',false)");
    await assert.rejects(state(), /Isolated sport access/);
  } finally {
    await db.pg.close();
  }
});
