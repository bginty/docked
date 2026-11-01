// Owner-nominated reviewer only. Existing member admission, no financial grants.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  customerSports,
  isHiddenCustomerSport,
} from "../src/core/customer-sports";

const root = process.cwd();
const mode = process.argv[2];
assert(["--inspect", "--apply-authorised-reviewer"].includes(mode));
const apply = mode === "--apply-authorised-reviewer";
const { email } = JSON.parse(
  readFileSync("private-data/play-reviewer/invitation.private.json", "utf8"),
);
assert(typeof email === "string" && email === email.toLowerCase());
assert.deepEqual(customerSports, ["nfl", "afl", "nrl"]);
assert(isHiddenCustomerSport("basketball"));
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
async function main() {
  try {
    const result = await sql.begin(async (tx) => {
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='90s'`;
      await tx`select pg_advisory_xact_lock(71820341)`;
      await tx`select pg_advisory_xact_lock(71820342)`;
      const [member] = await tx`
      select u.id,a.id admission,u.email_confirmed_at is not null confirmed,
      a.status,a.administrator,p.disabled_at,
      beta_private.admitted(u.id) admitted,beta_private.beta_gameplay_identity(u.id) gameplay,
      exists(select 1 from beta_private.roles r where r.user_id=u.id) privileged,
      exists(select 1 from credits_sandbox.access x where x.user_id=u.id) wallet,
      exists(select 1 from sports_feed.sport_sandbox_access x where x.user_id=u.id) sport,
      exists(select 1 from sports_feed.nba_beta_access x where x.user_id=u.id) multisport
      from auth.users u join beta_public.profiles p on p.id=u.id
      join beta_private.admissions a on a.user_id=u.id
      join beta_private.customer_invitations i on i.intended_user=u.id
      where lower(u.email)=${email} and i.email=${email} and i.revoked_at is null
      and i.account_bound_at is not null`;
      assert(member?.confirmed && member.admitted && member.gameplay);
      assert(
        member.status === "accepted" &&
          !member.administrator &&
          !member.privileged &&
          !member.disabled_at,
      );
      // Reuse the already-approved beta programme's deadline; never invent or extend it.
      const [policy] =
        await tx`select min(expires_at) expires_at,count(distinct expires_at)::int versions
      from sports_feed.nba_beta_access where enabled and expires_at>clock_timestamp()`;
      assert(policy.versions === 1 && policy.expires_at);
      const snapshot = async () => {
        const [row] = await tx`select revision,md5(document::text) wallet_hash,
        (select count(*) from credits_sandbox.journal)::text journal_count,
        (select count(*) from credits_sandbox.card_instances)::text inventory_count,
        (select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.user_id)::text,'')) from credits_sandbox.access x where x.user_id<>${member.id}) peer_wallet_access,
        (select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.user_id)::text,'')) from sports_feed.nba_beta_access x where x.user_id<>${member.id}) peer_sport_access,
        (select md5(coalesce(jsonb_agg(to_jsonb(x))::text,'')) from sports_feed.nba_beta_control x) sport_control,
        (select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.sport)::text,'')) from sports_feed.private_beta_sports x) visible_sport_control
        from credits_sandbox.state where id`;
        return row;
      };
      const before = await snapshot();
      const authority =
        "Owner-nominated Play reviewer ordinary member access, 1 November 2026; existing NFL/AFL/NRL beta programme only; no credits, cards, payments, owner role or NBA activation";
      if (apply) {
        await tx`insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)
        values(${member.id},'tester','Play reviewer',true,${authority}) on conflict(user_id) do nothing`;
        await tx`insert into sports_feed.sport_sandbox_access(user_id) values(${member.id}) on conflict do nothing`;
        // Legacy name is the common sport-membership guard. NBA remains separately hidden.
        await tx`insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)
        values(${member.id},true,${authority},${policy.expires_at}) on conflict(user_id) do nothing`;
        const [readback] =
          await tx`select a.kind,a.enabled,b.enabled sport_enabled,b.expires_at
        from credits_sandbox.access a join sports_feed.nba_beta_access b using(user_id)
        where a.user_id=${member.id}`;
        assert(
          readback.kind === "tester" &&
            readback.enabled &&
            readback.sport_enabled,
        );
        assert.equal(
          new Date(readback.expires_at).getTime(),
          new Date(policy.expires_at).getTime(),
        );
        if (!member.wallet || !member.sport || !member.multisport)
          await tx`insert into beta_private.admission_events(admission_id,action,actor,details)
          values(${member.admission},'reviewer_member_access_prepared','owner-authorised-release-preparation',
          ${tx.json({ sports: customerSports, creditsGranted: 0, cardsIssued: 0, privilegedRole: false, authority })})`;
      }
      assert.deepEqual(
        await snapshot(),
        before,
        "Customer economy or other access changed",
      );
      return {
        applied: apply,
        ordinaryAdmissionConfirmed: true,
        prior: {
          wallet: member.wallet,
          sport: member.sport,
          multisport: member.multisport,
        },
        existingProgrammeExpiresAt: policy.expires_at,
        customerSports,
        walletAndInventoryUnchanged: true,
        peerAccessUnchanged: true,
        featureFlagsUnchanged: true,
        creditsGranted: 0,
        cardsIssued: 0,
        privilegedRolesGranted: 0,
        before,
      };
    });
    const evidence = { at: new Date().toISOString(), ...result };
    writeFileSync(
      resolve(
        root,
        `docs/qa/customer-billing-20261101/reviewer-access-${apply ? "applied" : "inspected"}.json`,
      ),
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await sql.end({ timeout: 2 });
  }
}
void main().catch(() => {
  console.error(
    "Reviewer access preparation failed; transaction rolled back. Inspect before retrying.",
  );
  process.exitCode = 1;
});
