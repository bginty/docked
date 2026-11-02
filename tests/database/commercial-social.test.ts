import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
test("Commercial social: authoritative owned/opened cards, privacy, session and transfer locking", async () => {
  const d = await multiSportDatabase(undefined, false, undefined, true, true);
  const checks: string[] = [];
  let concurrent: ReturnType<typeof postgres> | undefined;
  try {
    await d.pg.exec(
      await readFile(
        "supabase/migrations/20261102023100_commercial_social_inventory.sql",
        "utf8",
      ),
    );
    const profiles: Record<string, string> = {};
    await d.q(
      "insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,evidence,features) values('AU','NSW','isolated-social-v1','2020-01-01','2100-01-01','2100-01-01',true,18,'Isolated synthetic social projection test',array['public_profiles','community_social'])",
    );
    for (const u of [d.user, d.other]) {
      await d.q(
        "insert into public.profiles(id,country,state,age_attested,accepted_version)values($1,'AU','NSW',true,'isolated-social-v1')",
        [u],
      );
      profiles[u] = (
        await d.q(
          "insert into private.social_profiles(user_id,handle,display_name,visibility)values($1,$2,'Synthetic member','members')returning id",
          [u, "qa" + u.replaceAll("-", "").slice(0, 14)],
        )
      )[0].id;
      await d.q(
        "insert into commercial_billing.accounts(member_id)values($1)",
        [u],
      );
    }
    const definition = randomUUID(),
      cards = [randomUUID(), randomUUID(), randomUUID()];
    await d.q(
      "insert into commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot)values($1,$2,'afl','RARE',5000,true,'isolated synthetic fixture','{}')",
      [definition, randomUUID()],
    );
    for (let i = 0; i < 3; i++) {
      const pack = randomUUID(),
        member = i === 2 ? d.other : d.user;
      await d.q(
        "insert into commercial_billing.packs(id,member_id,request,product,price,funding,draw_evidence,policy_version,opened_at)values($1,$2,$3,'{}',100,'[]','[]','isolated synthetic fixture',case when $4 then clock_timestamp() else null end)",
        [pack, member, randomUUID(), i !== 1],
      );
      await d.q(
        "insert into commercial_billing.cards(id,definition,serial,owner_id,pack,slot)values($1,$2,$3,$4,$5,0)",
        [cards[i], definition, i + 1, member, pack],
      );
    }
    const view = async (target = d.user) =>
      (
        await d.q("select commercial_billing.social_inventory($1) cards", [
          target,
        ])
      )[0].cards;
    await d.asUser(d.user);
    await d.pg.exec("set role docked_app");
    assert.deepEqual(
      (await view()).map((v: { id: string }) => v.id),
      [cards[0]],
    );
    await assert.rejects(
      d.q("select document from credits_sandbox.state"),
      /permission denied/,
    );
    await d.pg.exec("reset role");
    checks.push(
      "narrow runtime reads own opened commercial cards; no legacy sandbox grants",
    );
    await d.q(
      "insert into commercial_billing.listings(card,seller,price)values($1,$2,100)",
      [cards[0], d.user],
    );
    assert.equal((await view()).length, 1);
    assert.equal((await view(d.other)).length, 0);
    await d.q(
      "insert into private.social_collection_settings(profile_id,visibility,card_preferences)values($1,'members',$2)",
      [profiles[d.other], JSON.stringify({ [cards[2]]: { hidden: true } })],
    );
    assert.equal((await view(d.other)).length, 0);
    await d.q(
      "update private.social_collection_settings set card_preferences='{}' where profile_id=$1",
      [profiles[d.other]],
    );
    assert.equal((await view(d.other)).length, 1);
    await d.q(
      "insert into private.social_blocks(actor_id,target_id)values($1,$2)",
      [profiles[d.user], profiles[d.other]],
    );
    assert.equal((await view(d.other)).length, 0);
    checks.push(
      "listed ownership included; private, hidden-card and blocked-member collections denied",
    );
    await d.q(
      "update auth.sessions set not_after=now()-interval '1 minute' where id=$1",
      [d.sessions[d.user]],
    );
    await assert.rejects(view(), /Authenticated member required/);
    await d.q("update auth.sessions set not_after=null where id=$1", [
      d.sessions[d.user],
    ]);
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_beta_app",
      "docked_commercial_app",
    ])
      assert.equal(
        (
          await d.q(
            "select has_function_privilege($1,'commercial_billing.social_inventory(uuid)','execute') allowed",
            [role],
          )
        )[0].allowed,
        false,
      );
    checks.push(
      "expired sessions and direct browser/service/beta roles denied",
    );
    if (process.env.AUSTRALIAN_SALARY_TEST_DB) {
      const u = new URL(process.env.AUSTRALIAN_SALARY_TEST_DB);
      u.pathname = "/" + (await d.q("select current_database() db"))[0].db;
      concurrent = postgres(u.href, { max: 1, onnotice: () => {} });
      await d.pg.exec("begin");
      try {
        await view();
        await assert.rejects(
          concurrent.begin(async (tx) => {
            await tx`set local lock_timeout='200ms'`;
            await tx`update commercial_billing.cards set owner_id=${d.other} where id=${cards[0]}`;
          }),
          /lock timeout/,
        );
      } finally {
        await d.pg.exec("commit");
      }
      await concurrent`update commercial_billing.cards set owner_id=${d.other} where id=${cards[0]}`;
      assert.equal((await view()).length, 0);
      checks.push(
        "actual PostgreSQL transfer waits for snapshot transaction; transferred card immediately excluded",
      );
    }
    assert.equal(
      (
        await d.q(
          "select sales_enabled or issuance_enabled or transfers_enabled enabled from commercial_billing.control",
        )
      )[0].enabled,
      false,
    );
    assert.equal(
      (await d.q("select count(*)::int n from commercial_billing.receipts"))[0]
        .n,
      0,
    );
    checks.push(
      "projection/migration never activate billing or create receipts/credits",
    );
    if (process.env.AUSTRALIAN_SALARY_TEST_DB)
      await writeFile(
        "docs/qa/launch-resolution-20261102/commercial-social-postgres.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            engine: "isolated PostgreSQL 17",
            checks,
            passed: true,
            productionWrites: 0,
          },
          null,
          2,
        ),
      );
  } finally {
    await concurrent?.end();
    await d.pg.close();
  }
});
