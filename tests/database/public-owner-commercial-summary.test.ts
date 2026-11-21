import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { raritySupply } from "../../src/core/public-owner-summary";

test("Owner report uses dated AUD journals, segregates TEST receipts, excludes historical identities and has no direct table grant", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema private; create schema launch_transition; create schema commercial_billing; create schema sms_delivery;
    create role anon;create role authenticated;create role service_role;create role docked_beta_app;create role docked_commercial_app;create role docked_app;
    create table public.profiles(id int,created_at timestamptz);
    create table private.roles(user_id int);create table private.owner_support_events(created_at timestamptz);create table private.social_reports(created_at timestamptz);
    create function private.public_owner_actor() returns void language plpgsql as $$begin if current_setting('fixture.mfa',true) is distinct from 'owner-aal2' then raise exception 'Active Owner MFA required'; end if;end$$;
    create function launch_transition.identity_allowed(int) returns boolean language sql as $$select $1<>3$$;
    create function private.public_phone_verified(int) returns boolean language sql as $$select $1=1$$;
    create table commercial_billing.control(id boolean,environment text); insert into commercial_billing.control values(true,'commercial');
    create table commercial_billing.receipts(key text,environment text,money_recorded boolean,tax_cents int,gross_cents int,state text);
    create table commercial_billing.journals(id text,created_at timestamptz,unit text,receipt text);
    create table commercial_billing.lines(journal text,account text,amount int);
    create table commercial_billing.lots(remaining int, receipt text);create table commercial_billing.packs(product jsonb,created_at timestamptz);
    create table sms_delivery.windows(enabled boolean,allowlist uuid[],starts_at timestamptz,expires_at timestamptz,budget_aud_cents int,reserved_aud_cents int);
    grant usage on schema private to docked_app, authenticated;
    insert into public.profiles values(1,'2026-11-20 13:01Z'),(2,'2026-11-20 13:00Z'),(3,'2026-11-20 13:00Z');insert into private.roles values(2);
    insert into commercial_billing.receipts values('a','commercial',true,445,4900,'REVOKED'),('b','acceptance',true,900,9900,'PURCHASED'),('c','commercial',false,null,null,'PENDING');
    insert into commercial_billing.journals values('one','2026-11-20 13:05Z','AUD_CENTS','a'),('two','2026-11-21 13:05Z','AUD_CENTS','a'),('test','2026-11-20 13:05Z','AUD_CENTS','b');
    insert into commercial_billing.lines values('one','provider:google:receivable',4900),('two','provider:google:receivable',-4900),('test','provider:google:receivable',9900);
    insert into commercial_billing.lots values(0,'a'),(9900,'b');
    insert into commercial_billing.packs values('{"sport":"nfl","type":"STANDARD"}','2026-11-20 13:05Z');
    insert into sms_delivery.windows values(true,null,now()-interval '1 day',now()+interval '1 day',5000,100);
    `);
    await pg.exec(
      readFileSync(
        "supabase/migrations/20261121021000_owner_commercial_summary.sql",
        "utf8",
      ),
    );
    const q =
      "select private.owner_commercial_summary('2026-11-20 13:00Z','2026-11-22 13:00Z') summary";
    await pg.exec("set role authenticated");
    await assert.rejects(pg.query(q), /permission denied/);
    await pg.exec("reset role;set role docked_app");
    await assert.rejects(pg.query(q), /MFA required/);
    await pg.exec("set fixture.mfa='owner-aal2'");
    const {
      rows: [{ summary: s }],
    } = await pg.query<{
      summary: import("../../src/core/public-owner-summary").PublicOwnerSummary;
    }>(q);
    assert.deepEqual(s.days, [
      { day: "2026-11-21", customers: 1, sales: 4900, refunds: 0 },
      { day: "2026-11-22", customers: 0, sales: 0, refunds: 4900 },
    ]);
    assert.equal(s.chargeTax, 445);
    assert.equal(s.outstanding, 0);
    assert.equal(s.pending, 1);
    assert.equal(s.verified, 1);
    assert.equal(s.sms?.reserved, 100);
    assert.deepEqual(s.packs, [{ sport: "nfl", type: "STANDARD", total: 1 }]);
    await assert.rejects(
      pg.query("select * from sms_delivery.windows"),
      /permission denied/,
    );
    await assert.rejects(
      pg.query("select private.owner_commercial_summary(now(),now())"),
      /Invalid reporting period/,
    );
    await pg.exec(
      "reset role; update commercial_billing.control set environment='acceptance'",
    );
    await assert.rejects(pg.query(q), /Commercial reporting environment/);
  } finally {
    await pg.close();
  }
});
test("remaining lifetime capacity and new commercial issuance stay distinct", () => {
  const row = {
    tier: "ICON",
    issued: 1,
    cards: 0,
    available_lifetime_supply: 0,
  };
  assert.deepEqual(
    raritySupply([
      row,
      { ...row, issued: 0, available_lifetime_supply: 1 },
    ] as Parameters<typeof raritySupply>[0]),
    [{ tier: "ICON", issued: 1, cards: 0, remaining: 1 }],
  );
});
