import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
/** Called only inside the disposable full-schema acceptance harness. */
export async function privacyAcceptance(
  sql: Sql,
  owner: { id: string; session: string },
  member: { id: string },
  other: { id: string },
) {
  const request = randomUUID();
  const ownerContext = async <T>(fn: (tx: any) => Promise<T>, aal = "aal2") =>
    sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${owner.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner.id, session_id: owner.session, aal })},true)`;
      return fn(tx);
    });
  const [sp] =
    await sql`insert into beta_private.social_profiles(user_id,handle,display_name,bio) values(${member.id},${"test_" + randomUUID().replaceAll("-", "").slice(0, 12)},'Synthetic privacy member','Remove my profile') returning id`;
  await sql`insert into beta_private.social_posts(author_id,kind,body) values(${sp.id},'discussion','Synthetic private export test')`;
  await sql`insert into beta_private.social_media(owner_id,content,sha256,mime,width,height,alt) values(${sp.id},decode('74657374','hex'),${"a".repeat(64)},'image/webp',1,1,'Synthetic media')`;
  const ownership = JSON.stringify(
    await sql`select * from beta_fantasy.ownership_events order by id`,
  );
  const holdings = JSON.stringify(
    await sql`select * from beta_fantasy.cards order by id`,
  );
  const otherProfile = JSON.stringify(
    await sql`select * from beta_public.profiles where id=${other.id}`,
  );
  await assert.rejects(
    () =>
      ownerContext(
        (tx) =>
          tx`select beta_private.support_privacy_case(${request},${member.id},'Verified isolated request from test member')`,
        "aal1",
      ),
    /MFA/,
  );
  await ownerContext(
    (tx) =>
      tx`select beta_private.support_privacy_case(${request},${member.id},'Verified isolated request from test member')`,
  );
  const exported: any = await ownerContext(
    async (tx) =>
      (
        await tx`select beta_private.support_privacy_export(${request}) value`
      )[0].value,
  );
  assert.ok(exported.cards.length > 0);
  assert.equal(exported.posts[0].body, "Synthetic private export test");
  assert.equal(
    Buffer.from(exported.media[0].base64, "base64").toString(),
    "test",
  );
  assert.ok(!JSON.stringify(exported).includes(other.id));
  for (const role of ["anon", "authenticated", "docked_beta_app"])
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`);
          await tx`select beta_private.support_privacy_export(${request})`;
        }),
      /permission/,
    );
  // Inject a late failure: profile/media purge and admission suspension must roll back.
  await sql.unsafe(`create function beta_private.privacy_test_fail() returns trigger language plpgsql as $$begin if new.action='local-redaction' then raise exception 'injected privacy failure';end if;return new;end$$;
    create trigger privacy_test_fail before insert on beta_private.privacy_events for each row execute function beta_private.privacy_test_fail()`);
  await assert.rejects(
    () =>
      ownerContext(
        (tx) => tx`select beta_private.support_privacy_redact(${request})`,
      ),
    /injected/,
  );
  assert.equal(
    (
      await sql`select body from beta_private.social_posts where author_id=${sp.id}`
    )[0].body,
    "Synthetic private export test",
  );
  await sql.unsafe(
    "drop trigger privacy_test_fail on beta_private.privacy_events",
  );
  const receipt: any = await ownerContext(
    async (tx) =>
      (
        await tx`select beta_private.support_privacy_redact(${request}) value`
      )[0].value,
  );
  assert.equal(receipt.fullyAnonymous, false);
  assert.equal(receipt.betaAccessRevoked, true);
  await ownerContext(
    (tx) => tx`select beta_private.support_privacy_redact(${request})`,
  );
  assert.equal(
    (
      await sql`select count(*) n from beta_private.privacy_events where case_id=${request} and action='local-redaction'`
    )[0].n,
    "1",
  );
  assert.equal(
    (
      await sql`select count(*) n from beta_public.profiles where id=${member.id}`
    )[0].n,
    "0",
  );
  assert.equal(
    (
      await sql`select content from beta_private.social_media where owner_id=${sp.id}`
    )[0].content,
    null,
  );
  assert.equal(
    (
      await sql`select user_id from beta_private.social_profiles where id=${sp.id}`
    )[0].user_id,
    null,
  );
  assert.ok(
    (
      await sql`select email from beta_private.friends_roster where user_id=${member.id}`
    )[0].email.endsWith("@deleted.invalid"),
  );
  assert.equal(
    ownership,
    JSON.stringify(
      await sql`select * from beta_fantasy.ownership_events order by id`,
    ),
  );
  assert.equal(
    holdings,
    JSON.stringify(await sql`select * from beta_fantasy.cards order by id`),
  );
  assert.equal(
    otherProfile,
    JSON.stringify(
      await sql`select * from beta_public.profiles where id=${other.id}`,
    ),
  );
  assert.equal(
    (await sql`select count(*) n from auth.users where id=${member.id}`)[0].n,
    "1",
  );
  return "Support export/media, owner MFA/role denial, atomic redaction rollback/idempotency, admission email de-identification, unchanged ownership/history/other member; shared Auth explicitly pending";
}
