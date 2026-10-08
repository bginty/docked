import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Webhook } from "svix";

// Called only by the disposable loopback PostgreSQL harness. Vault and network
// transport are explicit local stand-ins; PostgreSQL/pgcrypto signing are real.
export async function schedulerScenarios(sql) {
  const checks = [];
  const secret = "v1,whsec_" + Buffer.alloc(32, 9).toString("base64");
  await sql.unsafe(`create schema extensions; create extension pgcrypto with schema extensions;
    create schema vault; create table vault.decrypted_secrets(name text,decrypted_secret text);
    create schema net; create table net.requests(id bigint generated always as identity,url text,body jsonb,headers jsonb,timeout_ms integer);
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $stub$
      insert into net.requests(url,body,headers,timeout_ms) values(url,body,headers,timeout_milliseconds) returning id
    $stub$;`);
  await sql.unsafe(
    readFileSync(
      "config/production-email/supabase/migrations/20261008133413_docked_auth_mail_scheduler.sql",
      "utf8",
    ),
  );
  const tick = async () =>
    (await sql`select private.docked_mail_tick() r`)[0].r;
  const health = async () =>
    (await sql`select private.docked_mail_health() r`)[0].r;
  const enqueue = async (id, mode = "production") => {
    const jobs = [
      {
        id: id.padEnd(64, id),
        fingerprint: "f".repeat(64),
        envelope: { version: 1, iv: "authored", ciphertext: "authored" },
      },
    ];
    await sql`select public.docked_mail_queue('enqueue',${sql.json({ mode, jobs })}::jsonb)`;
  };
  await enqueue("b");
  assert.equal(await tick(), null);
  assert.equal((await health()).enabled, false);
  assert.equal((await sql`select count(*)::int n from net.requests`)[0].n, 0);
  checks.push(
    "Default-disabled scheduler makes no network request even with pending mail",
  );

  for (const role of ["anon", "authenticated", "service_role", "docked_app"])
    for (const query of [
      "select private.docked_mail_tick()",
      "select private.docked_mail_health()",
      "select * from private.docked_mail_scheduler",
    ])
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx.unsafe("set local role " + role);
            await tx.unsafe(query);
          }),
        /permission denied/,
      );
  checks.push(
    "All four runtime roles denied scheduler execution, health and configuration",
  );

  await enqueue("c", "controlled");
  await sql`update private.docked_auth_mail_outbox set expires_at=clock_timestamp()-interval '1 second' where id=${"c".repeat(64)}`;
  await sql`update private.docked_mail_scheduler set enabled=true`;
  assert.equal(await tick(), null); // Missing Vault is fail-closed, but cleanup survives.
  assert.equal((await health()).last_error_code, "scheduler_unavailable");
  const expired = (
    await sql`select state,envelope from private.docked_auth_mail_outbox where id=${"c".repeat(64)}`
  )[0];
  assert.equal(expired.state, "expired");
  assert.equal(expired.envelope, null);
  checks.push(
    "Missing signing configuration fails closed and preserves expired-payload cleanup",
  );

  await sql`insert into vault.decrypted_secrets values('docked_auth_email_hook_existing',${secret})`;
  const ticks = await Promise.all(Array.from({ length: 24 }, () => tick()));
  assert.equal(ticks.filter((x) => x !== null).length, 1);
  const requests = await sql`select *,body::text body_text from net.requests`;
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(
    request.url,
    "https://pojoymtniryarxxunyvz.supabase.co/functions/v1/docked-auth-email/worker",
  );
  assert.equal(request.timeout_ms, 40000);
  assert.doesNotThrow(() =>
    new Webhook(secret.slice(3)).verify(request.body_text, request.headers),
  );
  assert.deepEqual(JSON.parse(request.body_text), {
    mode: "production",
    control: "drain",
  });
  assert.throws(() =>
    new Webhook(secret.slice(3)).verify(
      request.body_text + " ",
      request.headers,
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(request),
    /whsec_|support@|token_hash|PRIVATE KEY/,
  );
  checks.push(
    "24 concurrent ticks enqueue one fixed-endpoint request; real pgcrypto signature verifies with Svix",
  );

  const healthData = await health();
  assert.equal(healthData.stale_tick, false);
  assert.equal(healthData.last_error_code, null);
  assert.equal(healthData.pending, 1);
  assert.equal(healthData.expired, 1);
  assert.doesNotMatch(
    JSON.stringify(healthData),
    /whsec_|support@|ciphertext|fingerprint/,
  );
  checks.push(
    "Health reports counts, scheduler age and generic errors without recipients or tokens",
  );

  const worker = crypto.randomUUID();
  await sql`select public.docked_mail_queue('claim',${sql.json({ mode: "production", worker })}::jsonb)`;
  await sql`select public.docked_mail_queue('dispatch',${sql.json({ mode: "production", worker, id: "b".repeat(64) })}::jsonb)`;
  await sql`update private.docked_auth_mail_outbox set lease_until=clock_timestamp()-interval '1 second' where id=${"b".repeat(64)}`;
  await sql`update private.docked_mail_scheduler set enabled=false`;
  assert.equal(await tick(), null);
  assert.equal((await health()).unknown, 1);
  assert.equal((await sql`select count(*)::int n from net.requests`)[0].n, 1);
  checks.push(
    "Disabled cleanup holds crashed dispatch unknown without resending",
  );
  const attempts = await Promise.allSettled(
    Array.from({ length: 40 }, (_, index) =>
      enqueue((index + 32).toString(16)),
    ),
  );
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 32);
  assert.equal(attempts.filter((r) => r.status === "rejected").length, 8);
  assert.equal((await health()).pending, 32);
  checks.push(
    "Forty concurrent admissions accept exactly 32 and reject eight before acknowledging mail",
  );
  return checks;
}
