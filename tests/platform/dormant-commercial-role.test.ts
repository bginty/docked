import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("dormant commercial login proposal grants only inherited ledger access and refuses repeats", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role docked_commercial_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;create schema commercial_billing;create table commercial_billing.control(id boolean,environment text,sales_enabled boolean,issuance_enabled boolean,transfers_enabled boolean,gameplay_enabled boolean);insert into commercial_billing.control values(true,'commercial',false,false,false,false);create table commercial_billing.receipts(id int);create table commercial_billing.accounts(id int);grant usage on schema commercial_billing to docked_commercial_app;grant select on commercial_billing.receipts to docked_commercial_app;",
    );
    const proposal = readFileSync(
      "supabase/proposals/20261113_dormant_commercial_runtime_role.NOT-APPROVED.sql",
      "utf8",
    );
    await db.exec(proposal);
    const {
      rows: [role],
    } = await db.query<{
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      rolconnlimit: number;
    }>(
      "select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolconnlimit from pg_roles where rolname='docked_commercial_runtime'",
    );
    assert.deepEqual(role, {
      rolcanlogin: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      rolconnlimit: 6,
    });
    const {
      rows: [privilege],
    } = await db.query(
      "select has_table_privilege('docked_commercial_runtime','commercial_billing.receipts','select') can_read,has_table_privilege('docked_commercial_runtime','commercial_billing.control','update') can_activate,has_schema_privilege('docked_commercial_runtime','commercial_billing','create') can_create",
    );
    assert.deepEqual(privilege, {
      can_read: true,
      can_activate: false,
      can_create: false,
    });
    await assert.rejects(db.exec(proposal), /already exists/);
  } finally {
    await db.close();
  }
});
