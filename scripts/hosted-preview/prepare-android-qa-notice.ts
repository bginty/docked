// Operator-only, one labelled in-app system notice for the exact disposable QA A.
// Uses normal notification eligibility/preferences. No external delivery or invented activity.
import { readFile, writeFile } from "node:fs/promises";
import { db } from "../../src/server/db";
import { enqueueCommunityNotification } from "../../src/server/community-social";
import { previewDatabaseBound } from "../../src/core/preview-auth";
const project = "bckkllmndoxzpzdqrevb";
async function main() {
  let sql: ReturnType<typeof db> | undefined;
  try {
    if (process.argv.length !== 3 || process.argv[2] !== `--confirm-project=${project}`)
      throw Error("EXACT_CONFIRMATION_REQUIRED");
    const connection = JSON.parse(await readFile("private-data/hosted-preview/connection.json", "utf8"));
    const fixture = JSON.parse(await readFile("private-data/android-preview/acceptance.json", "utf8"));
    const a = fixture.memberA;
    if (connection.projectRef !== project || connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
        process.env.DATABASE_URL !== connection.databaseUrl || !previewDatabaseBound(process.env) ||
        process.env.APP_ENV !== "preview" || process.env.SUPABASE_ENV !== "preview" ||
        fixture.projectRef !== project || fixture.qaFixture !== true ||
        a?.email !== "docked-preview-s24-qa-a-20261003@example.invalid" || !/^[0-9a-f-]{36}$/i.test(a.id))
      throw Error("EXACT_QA_SCOPE_REQUIRED");
    sql = db();
    const receipt = await sql.begin(async (tx) => {
      const recipient = (await tx`select s.id from auth.users u join private.social_profiles s on s.user_id=u.id
        where u.id=${a.id} and u.email=${a.email} and s.status='active' and not s.is_official`)[0];
      if (!recipient || (await tx`select 1 from private.feature_flags where enabled`).length ||
          (await tx`select 1 from preview_auth.configuration where enabled`).length)
        throw Error("CLOSED_QA_BOUNDARY_REQUIRED");
      await tx`select set_config('docked.hosted_preview_project',${project},true)`;
      const visible = async () => Number((await tx`select count(*)::int count from private.social_notifications n
        where n.recipient_id=${recipient.id} and n.expires_at>clock_timestamp()
        and (n.type<>'leaderboard' or private.community_feature_allowed(${a.id},'leaderboards'))
        and (n.actor_id is null or private.social_profile_visible(${recipient.id},n.actor_id,false))
        and (n.post_id is null or private.social_post_visible(${recipient.id},n.post_id))`)[0].count);
      const before = await visible();
      let inserted = false;
      if (before === 0) inserted = (await enqueueCommunityNotification(tx, {
        recipientId: String(recipient.id), type: "system", title: "QA ONLY: timezone rendering check. This is a system test notice.",
        href: "/notifications", dedupeKey: "android-https-qa-a-system-timezone-20261003", groupKey: "qa-system-timezone",
      })) === true;
      const count = await visible();
      if (count === 0) throw Error("NORMAL_NOTIFICATION_POLICY_DENIED");
      return { projectRef: project, recordedAt: new Date().toISOString(), ready: true, visibleCount: count,
        insertedLabelledSystemNotice: inserted, externalDelivery: false, accountScope: "exact disposable QA A only",
        note: "A labelled system QA notice is inserted only when no visible notice survives; ordinary preferences, quota and eligibility remain enforced. Removed by normal account erasure." };
    });
    await writeFile("docs/qa/android-https-preview/qa-notification-setup.json", JSON.stringify(receipt, null, 2) + "\n");
    console.log(JSON.stringify({ ready: receipt.ready, visibleCount: receipt.visibleCount, insertedLabelledSystemNotice: receipt.insertedLabelledSystemNotice, type: receipt.insertedLabelledSystemNotice ? "system" : "existing" }));
  } catch {
    console.error("Exact QA notice setup not confirmed; no identifiers or credentials emitted.");
    process.exitCode = 1;
  } finally { if (sql) await sql.end({ timeout: 5 }); }
}
void main();
