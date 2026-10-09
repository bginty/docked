// Actual pinned postgres client over an in-memory protocol bridge: no TCP or provider I/O.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Duplex } from "node:stream";
import type { Socket } from "node:net";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { reservedTransaction } from "../../src/server/reserved-transaction";
import { completeTrialRequestSQL } from "../../src/server/provider-trial-queries";
import {
  trialRequestAuthority,
  completeTrialRequest,
} from "../../src/server/provider-trial-database";
import { fetchTrialSports } from "../../src/providers/market-data";
import {
  newTrialProgress,
  trackedTrialFetch,
} from "../../src/core/provider-trial-diagnostics";

class OfflinePostgresWire extends Duplex {
  private startup = true;
  constructor(private readonly pg: PGlite) {
    super();
  }
  _read() {}
  _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    if (this.startup) {
      this.startup = false;
      // AuthenticationOk, BackendKeyData and ReadyForQuery. PGlite is already initialised.
      queueMicrotask(() =>
        this.push(
          Buffer.from(
            "5200000008000000004b0000000c00000001000000015a0000000549",
            "hex",
          ),
        ),
      );
      callback();
      return;
    }
    if (chunk[0] === 0x58) {
      callback();
      this.destroy();
      return;
    }
    void this.pg.execProtocolRaw(chunk).then(
      (result) => {
        this.push(Buffer.from(result));
        callback();
      },
      (error) => callback(error as Error),
    );
  }
}

test(
  "pinned driver preserves a max:1 reserved lease through transactions and serializes JSONB objects once",
  { timeout: 30000 },
  async (t) => {
    t.diagnostic("offline driver starting");
    const pg = new PGlite();
    await pg.exec("select 1");
    t.diagnostic("offline database ready");
    const statements: string[] = [];
    t.after(() =>
      t.diagnostic(
        JSON.stringify({
          statements: statements.length,
          last: statements.at(-1)?.slice(0, 45),
        }),
      ),
    );
    let transports = 0;
    const options = {
      max: 1,
      ssl: false as const,
      idle_timeout: 0,
      max_lifetime: 0,
      connection: { application_name: "fictional-offline-driver-regression" },
      socket: () => {
        transports++;
        return new OfflinePostgresWire(pg) as unknown as Socket;
      },
      debug: (_id: number, query: string) => {
        statements.push(query);
      },
      onnotice: () => {},
    };
    // postgres supports custom transports at runtime; its Options declaration omits socket.
    const sql = postgres(options);
    let reserved: postgres.ReservedSql | undefined;
    try {
      reserved = await sql.reserve();
      assert.equal(
        typeof (reserved as unknown as { begin?: unknown }).begin,
        "undefined",
      );
      assert.equal(typeof reserved.unsafe, "function");
      await reserved.unsafe(`create schema private;
      create table private.provider_trial_requests(id text,permit_id text,poll_run_id text,status text,completed_at timestamptz,error_code text,diagnostics jsonb,reported_credits int);
      insert into private.provider_trial_requests values('fixture','permit','poll','RESERVED',null,null,'{}',null);`);
      const diagnostic = {
        stage: "RESPONSE_RECEIVED",
        quota: { remaining: 499 },
        results: ["fixture-only"],
      };
      const value = await reservedTransaction(reserved, async (tx) => {
        assert.equal(tx, reserved);
        await tx`update private.provider_trial_requests set reported_credits=${1} where id='fixture'`;
        const rows = await tx.unsafe(completeTrialRequestSQL, [
          "permit",
          "poll",
          "SUCCESS",
          null,
          tx.json(diagnostic),
        ]);
        assert.equal(rows.length, 1);
        return "same-lease";
      });
      assert.equal(value, "same-lease");
      const [stored] =
        await reserved`select diagnostics,jsonb_typeof(diagnostics) kind,reported_credits,status from private.provider_trial_requests`;
      assert.deepEqual(stored.diagnostics, diagnostic);
      assert.equal(stored.kind, "object");
      assert.equal(stored.reported_credits, 1);
      assert.equal(stored.status, "SUCCESS");
      // This reproduces the old bug with the real driver's server-discovered JSONB serializer.
      const [doubleEncoded] = await reserved.unsafe(
        "select jsonb_typeof($1::jsonb) kind",
        [JSON.stringify(diagnostic)],
      );
      assert.equal(doubleEncoded.kind, "string");
      await assert.rejects(
        reservedTransaction(reserved, async (tx) => {
          await tx`update private.provider_trial_requests set reported_credits=${99}`;
          throw Error("fictional action failure");
        }),
        /fictional action failure/,
      );
      assert.equal(
        (
          await reserved`select reported_credits from private.provider_trial_requests`
        )[0].reported_credits,
        1,
      );
      await reservedTransaction(reserved, async (tx) => {
        await assert.rejects(
          reservedTransaction(tx, async () => {}),
          /cannot nest/,
        );
        assert.equal((await tx`select 7 value`)[0].value, 7);
      });
      assert.equal(transports, 1);
      assert.deepEqual(
        statements.filter((q) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(q)),
        ["BEGIN", "COMMIT", "BEGIN", "ROLLBACK", "BEGIN", "COMMIT"],
      );

      // The reservation RPC is a small offline stand-in here; full guard SQL is tested
      // in phase5a-trial.test.ts. All real response/quota/completion code runs unchanged.
      await reserved.unsafe(`alter table private.provider_trial_requests
        add column trial_id text,add column reserved_credits integer default 0,
        add column remaining integer,add column used integer,add column headers_at timestamptz;
        create table private.provider_trials(id text primary key);
        insert into private.provider_trials values('catalog-trial');
        create table private.provider_poll_runs(id text primary key,quota_charge integer not null);
        insert into private.provider_poll_runs values('catalog-poll',0);
        create table private.source_health(provider text primary key,credits_remaining bigint,credits_used bigint,
          healthy boolean,failure_reason text,circuit_until timestamptz);
        insert into private.source_health values('the-odds-api',500,0,true,null,null);
        create function private.reserve_provider_trial(p_permit text,p_hash text,p_scope text,p_cost integer,p_poll text)
        returns text language plpgsql as $$begin
          if p_permit<>'catalog-permit' or p_hash<>'fictional-token-hash' or p_scope<>'sports' or p_cost<>0 or p_poll<>'catalog-poll'
          then raise exception 'Offline scope mismatch';end if;
          insert into private.provider_trial_requests(id,permit_id,trial_id,poll_run_id,status,reserved_credits,diagnostics)
          values('catalog-request',p_permit,'catalog-trial',p_poll,'RESERVED',p_cost,'{}');
          return 'catalog-request';end$$;`);
      const progress = newTrialProgress();
      let injectedCalls = 0;
      const response = await fetchTrialSports(
        trialRequestAuthority(
          reserved,
          "catalog-poll",
          "catalog-permit",
          "fictional-token-hash",
          "fictional-provider-key",
          progress,
        ),
        trackedTrialFetch(progress, async () => {
          injectedCalls++;
          const [request] =
            await reserved!`select status,reserved_credits from private.provider_trial_requests where id='catalog-request'`;
          assert.equal(request.status, "RESERVED");
          assert.equal(request.reserved_credits, 0);
          return new Response(
            JSON.stringify([
              {
                key: "basketball_nba",
                group: "Fictional basketball",
                title: "Fictional NBA fixture",
                description: "Authored offline test",
                active: true,
                has_outrights: false,
              },
            ]),
            {
              headers: {
                "x-requests-remaining": "499",
                "x-requests-used": "1",
                "x-requests-last": "0",
              },
            },
          );
        }),
      );
      assert.equal(injectedCalls, 1);
      assert.equal(progress.httpResponseReceived, true);
      assert.equal(progress.httpStatus, 200);
      assert.equal(progress.stage, "PAYLOAD_VALIDATION");
      const [observed] =
        await reserved`select remaining,used,reported_credits,headers_at,completed_at from private.provider_trial_requests where id='catalog-request'`;
      assert.equal(observed.remaining, 499);
      assert.equal(observed.used, 1);
      assert.equal(observed.reported_credits, 0);
      assert.ok(observed.headers_at instanceof Date);
      assert.equal(observed.completed_at, null);
      const summary = {
        sports: response.sports.map((s) => s.key),
        responseReceived: true,
      };
      assert.equal(
        await completeTrialRequest(
          reserved,
          "catalog-permit",
          "catalog-poll",
          true,
          summary,
        ),
        true,
      );
      const [completed] =
        await reserved`select status,diagnostics,jsonb_typeof(diagnostics) kind,completed_at from private.provider_trial_requests where id='catalog-request'`;
      assert.equal(completed.status, "SUCCESS");
      assert.equal(completed.kind, "object");
      assert.deepEqual(completed.diagnostics, summary);
      assert.ok(completed.completed_at instanceof Date);
      const [health] =
        await reserved`select credits_remaining::integer remaining,credits_used::integer used from private.source_health`;
      assert.deepEqual({ ...health }, { remaining: 499, used: 1 });
      assert.equal(
        (await reserved`select quota_charge from private.provider_poll_runs`)[0]
          .quota_charge,
        0,
      );
      assert.equal(transports, 1);
      reserved.release();
      reserved = undefined;
      assert.equal((await sql`select 9 value`)[0].value, 9);
      assert.equal(transports, 1);
    } finally {
      reserved?.release();
      await sql.end({ timeout: 1 });
      await pg.close();
    }
  },
);
