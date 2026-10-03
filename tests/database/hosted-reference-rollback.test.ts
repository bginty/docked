import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { runMarketReferenceRollback } from "../../scripts/hosted-preview/market-reference-rollback";

// Disposable local PostgreSQL only. No network connections, real Auth users or
// hosted acceptance claims. Exercise the operator helper through postgres.js's
// actual JSON parameter serializer instead of PGlite's raw-string convenience.
test("rollback helper uses typed JSON parameters and rolls every fixture back", async () => {
  const pg = new PGlite();
  const driver = postgres("postgres://localhost:5432/never_connected");
  let typedJsonParameters = 0;
  try {
    await pg.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    const actors = {
      member: {
        userId: randomUUID(),
        sessionId: randomUUID(),
        aal: "aal1" as const,
      },
      other: {
        userId: randomUUID(),
        sessionId: randomUUID(),
        aal: "aal1" as const,
      },
      admin: {
        userId: randomUUID(),
        sessionId: randomUUID(),
        aal: "aal2" as const,
      },
    };
    for (const [index, [label, actor]] of Object.entries(actors).entries()) {
      await pg.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,clock_timestamp())",
        [actor.userId, `docked-preview-${label}@example.invalid`],
      );
      await pg.query("insert into auth.sessions(id,user_id) values($1,$2)", [
        actor.sessionId,
        actor.userId,
      ]);
      await pg.query(
        "insert into public.profiles(id,country,state,age_attested,accepted_version) values($1,'XX','LOCAL_TEST',true,'fixture')",
        [actor.userId],
      );
      await pg.query(
        "insert into private.social_profiles(user_id,handle,display_name) values($1,$2,'Local rollback fixture')",
        [actor.userId, `localfixture${index}`],
      );
    }
    await pg.query(
      "insert into private.roles(user_id,role) values($1,'admin')",
      [actors.admin.userId],
    );
    let savepoint = 0;
    type LocalTransaction = {
      json: typeof driver.json;
      unsafe: (
        query: string,
        parameters?: unknown[],
      ) => Promise<Record<string, unknown>[]>;
      savepoint: <T>(fn: (sql: LocalTransaction) => Promise<T>) => Promise<T>;
    };
    const tx: LocalTransaction = {
      json: driver.json,
      unsafe: async (query: string, parameters: unknown[] = []) => {
        const encoded = parameters.map((parameter) => {
          if (
            parameter &&
            typeof parameter === "object" &&
            "type" in parameter &&
            "value" in parameter
          ) {
            const typed = parameter as { type: number; value: unknown };
            assert.ok([114, 3802].includes(typed.type));
            typedJsonParameters++;
            return driver.options.serializers[typed.type](typed.value);
          }
          if (/^insert\b/i.test(query.trim()) && typeof parameter === "string")
            assert.ok(
              !/^[\[{]/.test(parameter),
              "JSON insert parameters must carry an explicit postgres.js JSON type",
            );
          return parameter;
        });
        return (await pg.query<Record<string, unknown>>(query, encoded)).rows;
      },
      savepoint: async <T>(
        fn: (sql: LocalTransaction) => Promise<T>,
      ): Promise<T> => {
        const name = `local_probe_${++savepoint}`;
        await pg.exec(`savepoint ${name}`);
        try {
          const result = await fn(tx);
          await pg.exec(`release savepoint ${name}`);
          return result;
        } catch (error) {
          await pg.exec(
            `rollback to savepoint ${name}; release savepoint ${name}`,
          );
          throw error;
        }
      },
    };
    const connection = {
      options: {
        user: "local-disposable",
        host: ["db.bckkllmndoxzpzdqrevb.supabase.co"],
      },
      begin: async <T>(fn: (sql: typeof tx) => Promise<T>) => {
        await pg.exec("begin");
        try {
          return await fn(tx);
        } finally {
          await pg.exec("rollback");
        }
      },
    } as unknown as postgres.Sql;
    const result = await runMarketReferenceRollback(connection, actors, {
      waitForSettlement: false,
    });
    assert.equal(result.rolledBack, true);
    assert.equal(result.settlement, "not_run_requires_actual_time");
    assert.ok(result.checks.includes("settlement_before_event_denied"));
    assert.ok(typedJsonParameters >= 10);
    for (const table of [
      "events",
      "odds_snapshots",
      "market_references",
      "community_edges",
      "community_settlements",
    ])
      assert.equal(
        (
          await pg.query<{ n: number }>(
            `select count(*)::int n from private.${table}`,
          )
        ).rows[0].n,
        0,
      );
  } finally {
    await driver.end();
    await pg.close();
  }
});
