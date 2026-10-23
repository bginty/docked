import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { grantOwnedPlayFixtures } from "../fixtures/owned-play";
import { betaStatement } from "../../src/server/beta-sql";
import production from "../../config/hosted-production.json";

for (const config of [aflConfiguration, nrlConfiguration])
  test(`${config.label} actual state service supplies shared team-name context without bypassing consent`, async () => {
    const db = await multiSportDatabase(config, true);
    try {
      await grantOwnedPlayFixtures(db);
      // Preserve the real production eligibility chain, channel/project and
      // consent checks. Only the isolated Auth transport uses fixture identities.
      await db.restoreProductionEligibility();
      await db.pg.exec(`
        create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;
        create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;
        update sports_feed.nfl_control set enabled=true;
        insert into sports_feed.nba_beta_control values(true,true,'Isolated regression','2099-01-01');
        update sports_feed.private_beta_sports set enabled=true,authority='Isolated regression';
        update beta_private.admission_control set enabled=true,testers_enabled=true,policy_digest=repeat('a',64),policy_versions='{"terms":"test-terms","privacy":"test-privacy","beta":"fixture","community":"fixture","fantasy":"fixture","competition":"fixture","responsible_gambling":"fixture"}',approved_by='isolated-fixture',approved_at=clock_timestamp();
      `);
      await db.q(
        "update beta_fantasy.settings set enabled=true,deployment_mode='production',production_ref=$1,terms_version='test-terms',privacy_version='test-privacy'",
        [production.supabaseProjectRef],
      );
      for (const u of [db.user, db.other]) {
        await db.q(
          "insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at) values($1,$2,md5($1)||md5($1),gen_random_uuid(),clock_timestamp()+interval '1 day')",
          [`${u}@example.invalid`, u],
        );
        await db.q(
          "update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions=(select policy_versions from beta_private.admission_control where id) where user_id=$1",
          [u],
        );
        await db.q(
          "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Isolated regression','infinity')",
          [u],
        );
        await db.q(
          "insert into beta_public.profiles(id,country,state,age_attested,accepted_version) values($1,'AU','NSW',true,'test-terms')",
          [u],
        );
        await db.q(
          "insert into beta_private.consent_events(user_id,purpose,granted,version,actor) values($1,'privacy',true,'test-privacy','isolated-test')",
          [u],
        );
      }
      await db.q(
        "insert into beta_fantasy.team_names(user_id,name) values($1,'QA Harbour'),($2,'QA Away')",
        [db.user, db.other],
      );
      await db.q("select set_config('docked.fantasy_channel','',false)");
      await assert.rejects(
        db.q("select beta_fantasy.my_team_name()"),
        /Production release channel mismatch/,
      );
      await db.q("select set_config('docked.fantasy_channel','beta',false)");
      await assert.rejects(
        db.q("select beta_fantasy.my_team_name()"),
        /Production Fantasy context required/,
      );
      await db.q("select set_config('docked.fantasy_channel','',false)");

      const result = await build({
        entryPoints: ["src/server/sport-sandbox.ts"],
        bundle: true,
        write: false,
        platform: "node",
        format: "cjs",
        packages: "external",
        plugins: [
          {
            name: "isolated-transport",
            setup(b) {
              b.onResolve(
                {
                  filter:
                    /^(server-only|\.\/auth|\.\/db|@\/core\/nba-private-beta|\.\/nba-private-beta)$/,
                },
                (args) => ({ path: args.path, external: true }),
              );
            },
          },
        ],
      });
      let member = db.user;
      const transaction = async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ) => {
        const sql = strings.reduce(
          (out, s, i) => out + (i ? `$${i}` : "") + s,
          "",
        );
        return db.q(betaStatement(sql), values);
      };
      const transport = {
        begin: async (fn: (tx: typeof transaction) => Promise<unknown>) => {
          await db.pg.exec("begin;set local role docked_beta_app");
          try {
            const result = await fn(transaction);
            await db.pg.exec("commit");
            return result;
          } catch (error) {
            await db.pg.exec("rollback");
            throw error;
          }
        },
      };
      const nativeRequire = createRequire(import.meta.url);
      const module = {
        exports: {} as { sportSandbox: (sport: string) => Promise<any> },
      };
      vm.runInNewContext(result.outputFiles[0].text, {
        module,
        exports: module.exports,
        console,
        structuredClone,
        process: {
          env: {
            DOCKED_RELEASE_CHANNEL: "beta",
            DOCKED_SPORTS_PRIVATE_BETA: "true",
          },
        },
        require: (id: string) =>
          id === "server-only"
            ? {}
            : ["@/core/nba-private-beta", "./nba-private-beta"].includes(id)
              ? { nbaPrivateBetaEnabled: () => true }
              : id === "./auth"
                ? {
                    requireIdentity: async () => ({
                      user: { id: member },
                      sessionId: db.sessions[member],
                      aal: "aal2",
                    }),
                  }
                : id === "./db"
                  ? { db: () => transport, rateLimit: async () => true }
                  : nativeRequire(id),
      });
      const state = (await module.exports.sportSandbox(config.id)).state;
      assert.equal(state.team_name, "QA Harbour");
      assert.equal(state.sport, config.id);
      assert.equal(state.cards.length, db.inventories[member].length);
      assert(
        state.cards.every(
          (c: any) => c.owner_id === member && c.sport === config.id,
        ),
      );
      member = db.other;
      assert.equal(
        (await module.exports.sportSandbox(config.id)).state.team_name,
        "QA Away",
      );
      await db.q("update beta_fantasy.settings set terms_version='new-terms'");
      await assert.rejects(
        module.exports.sportSandbox(config.id),
        /Verified current-consent account required/,
      );
      await db.q("update beta_fantasy.settings set terms_version='test-terms'");
      await db.q(
        "update sports_feed.nba_beta_access set enabled=false where user_id=$1",
        [member],
      );
      await assert.rejects(
        module.exports.sportSandbox(config.id),
        /Verified NBA beta access required/,
      );
      assert.equal(
        (
          await db.q(
            "select current_setting('docked.fantasy_channel',true) value",
          )
        )[0].value,
        "",
        "Context does not leak between transactions",
      );
    } finally {
      await db.pg.close();
    }
  });
