import type { Sql } from "postgres";
import type { CreditsState } from "../core/credits-sandbox";
/** Transactional in-app account notices; never email, push, bank data or evidence. */
export async function persistRedemptionNotices(
  tx: Sql,
  old: CreditsState,
  current: CreditsState,
) {
  const previous = new Set(old.redemption?.notices.map((n) => n.id) ?? []);
  for (const n of current.redemption?.notices ?? []) {
    if (previous.has(n.id)) continue;
    const title = n.type.startsWith("identity-")
      ? "Your identity review has an update"
      : "Your withdrawal request has an update";
    await tx`insert into private.social_notifications(recipient_id,type,title,href,group_key,dedupe_key)
      select id,'account',${title},'/profile/withdrawals','redemption',${`redemption:${n.id}`} from private.social_profiles where user_id=${n.member}::uuid and status='active'
      on conflict(dedupe_key) do nothing`;
  }
}
