import { authUsersRelation } from "@/core/auth-relations";
import { db } from "./db";
export async function scheduleOnboarding(userId: string) {
  const sql = db();
  await sql.begin(async (tx) => {
    const rows =
      await tx`select p.id,n.education from public.profiles p join public.notification_preferences n on n.user_id=p.id join ${tx.unsafe(authUsersRelation())} u on u.id=p.id where p.id=${userId} and p.disabled_at is null and u.email_confirmed_at is not null`;
    if (!rows[0]) return;
    const items = [
      {
        key: "welcome",
        kind: "service",
        days: 0,
        title: "Welcome to Docked",
        text: "Your account is verified. Docked is a fantasy sports card platform: collect, build and compete. Gameplay access depends on your invitation. Manage your account at /dashboard. Optional communications remain under your control.",
      },
    ];
    for (const i of items)
      await tx`insert into private.outbox(dedupe_key,kind,user_id,payload,available_at,expires_at) values(${`onboarding:${userId}:${i.key}`},${i.kind},${userId},${tx.json({ subject: i.title, text: i.text, editorialApproval: "fantasy-account-welcome-v1" })},now()+${i.days}*interval '1 day',now()+${i.days + 2}*interval '1 day') on conflict do nothing`;
  });
}
