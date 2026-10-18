// Called only by the loopback-pinned PostgreSQL settlement runner, with synthetic accounts.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { marketActors } from "../tests/fixtures/marketplace-state";
export async function betaTradingConcurrency(sql: Sql, connections: Sql[]) {
  const owner = marketActors[0].id,
    member = marketActors[1].id;
  // SQL session adapters here are explicit: this suite tests actual locks/grants,
  // not GoTrue or application HTTP. Real authentication is a separate gate.
  await sql.unsafe(`create or replace function beta_private.active_member_session() returns boolean language sql as $$select true$$;
    create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select true$$;
    create or replace function beta_private.profile_admission_guard() returns trigger language plpgsql as $$begin return new;end$$;`);
  for (const id of [owner, member]) {
    await sql`insert into beta_public.profiles(id,country,state,age_attested,accepted_version) values(${id},'AU','NSW',true,'LOCAL') on conflict(id) do nothing`;
    await sql`insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note) values(${id},'tester','LOCAL trading QA',true,'LOCAL approval') on conflict(user_id) do update set enabled=true`;
    await sql`insert into credits_sandbox.trading_members values(${id},true,'LOCAL trading approval')`;
  }
  await sql`insert into beta_private.roles(user_id,role) values(${owner},'owner') on conflict(user_id) do update set role='owner'`;
  await sql`update credits_sandbox.trading_control set approval_reference='LOCAL trading approval',approved_at=now(),sale=true,swap=true,combined=true,paused=false where id`;
  const [before] =
    await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
  const [a, b] = connections;
  const pids = await Promise.all(
    [a, b].map((c) => c`select pg_backend_pid() pid`),
  );
  assert.notEqual(pids[0][0].pid, pids[1][0].pid);
  for (const c of [a, b])
    await c`select set_config('request.jwt.claim.sub',${owner},false),set_config('request.jwt.claims',${JSON.stringify({ aal: "aal2" })},false)`;
  let release!: () => void, ready!: () => void;
  const hold = new Promise<void>((r) => (release = r)),
    locked = new Promise<void>((r) => (ready = r));
  const pausing = a.begin(async (tx) => {
    await tx`select credits_sandbox.trading_set_pause(true,0,${randomUUID()}::uuid,'LOCAL race pause')`;
    ready();
    await hold;
  });
  await locked;
  let finished = false;
  const waiting = b.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(71820342)`;
    const [row] =
      await tx`select credits_sandbox.trading_access(${member}::uuid,'private-beta-trading-v1') v`;
    assert.equal(
      row.v.enabled,
      false,
      "A settlement queued behind pause sees the committed pause",
    );
    finished = true;
  });
  try {
    let blocked = false;
    for (let i = 0; i < 40; i++) {
      const [row] =
        await sql`select wait_event_type from pg_stat_activity where pid=${pids[1][0].pid}`;
      if (row?.wait_event_type === "Lock") {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(blocked, true);
    assert.equal(finished, false);
  } finally {
    release();
    await Promise.all([pausing, waiting]);
  }
  const [after] =
    await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
  assert.deepEqual(
    after,
    before,
    "Control operations do not mutate assets/credits or history revision",
  );
  return "Separate PostgreSQL sessions: pending settlement waits for owner pause and observes disabled access; state hash/revision unchanged";
}
