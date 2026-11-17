import assert from "node:assert/strict";
import { createHash } from "node:crypto";
/** Restricted OFF-only adapter. Caller verifies exact package and authority. */
export function productionPhoneAdapter(sql, request, plan) {
  const ref = "pojoymtniryarxxunyvz";
  const validRef = (r) => assert.equal(r, ref);
  const validWindow = (w) => assert.equal(w, plan.windowId);
  return {
    project(r) {
      validRef(r);
      return request(r, "");
    },
    config(r) {
      validRef(r);
      return request(r, "/config/auth");
    },
    disable(r, payload) {
      validRef(r);
      assert.deepEqual(payload, {
        external_phone_enabled: false,
        hook_send_sms_enabled: false,
      });
      return request(r, "/config/auth", payload);
    },
    async window(w) {
      validWindow(w);
      const [r] =
        await sql`select w.*,(select count(*)::int from sms_delivery.attempts a where a.window_id=w.id) attempts from sms_delivery.windows w where w.id=${w}`;
      assert(r, "Exact window required");
      const ids = r.allowlist;
      assert(
        Array.isArray(ids) && ids.length === 1,
        "Founder-only allowlist required",
      );
      return {
        id: r.id,
        enabled: r.enabled,
        budgetAudCents: r.budget_aud_cents,
        reservedAudCents: r.reserved_aud_cents,
        attempts: r.attempts,
        allowlistCount: ids.length,
        founderIdentitySha256: createHash("sha256")
          .update(ids[0])
          .digest("hex"),
        startsAt: new Date(r.starts_at).toISOString(),
        until: new Date(r.expires_at).toISOString(),
        authoritySha256: r.authority_reference,
      };
    },
    async closeWindow(w) {
      validWindow(w);
      await sql.begin(async (tx) => {
        const [r] =
          await tx`select id,authority_reference from sms_delivery.windows where id=${w} for update`;
        assert.equal(
          r?.authority_reference,
          plan.approvalSha256,
          "Unrelated authority must not be changed",
        );
        await tx`update sms_delivery.windows set enabled=false where id=${w}`;
        // Record once; never delete attempts or restore reservation balance.
        await tx`insert into private.audit_events(actor,action,subject,details)
          select 'approved-phone-watchdog','production_phone_window_closed',${w},${tx.json({ approvalSha256: plan.approvalSha256 })}
          where not exists(select 1 from private.audit_events where action='production_phone_window_closed' and subject=${w})`;
      });
    },
  };
}
