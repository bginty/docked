import { randomUUID } from "node:crypto";
import { projectUrl } from "../../supabase/functions/docked-auth-email/mail.mjs";
import { billingOpsAlertPolicy } from "./billing-ops-alerts.mjs";

/** Restricted commercial connection only; zero arguments prevent caller-chosen
 * messages/recipients/counters. SQL independently checks its approved window. */
export async function enqueueBillingOpsAlert(sql, env, now = Date.now()) {
  if (!billingOpsAlertPolicy(env, now)) return null;
  const [row] = await sql`select public.docked_billing_ops_enqueue() id`;
  return row?.id ?? null;
}

/** Existing server Graph environment only. The actual PostgREST service_role
 * EXECUTE grant authenticates this RPC; a client JWT/custom GUC cannot grant it.
 * No secret is loaded/copied here and no Auth hook/scheduler is modified. */
export function billingOpsQueueRpc(env, fetcher = fetch) {
  if (
    !billingOpsAlertPolicy(env) ||
    env.SUPABASE_URL !== projectUrl ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw Error("Operational queue unavailable");
  const worker = randomUUID();
  const rpc = async (action, data) => {
    const response = await fetcher(
      projectUrl + "/rest/v1/rpc/docked_billing_ops_queue",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(4000),
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_action: action, p_data: { ...data, worker } }),
      },
    );
    if (!response.ok) throw Error("Operational queue operation unavailable");
    return response.json();
  };
  const ownLease = (lease) => {
    if (lease !== worker) throw Error("Operational lease mismatch");
  };
  return {
    claim: () => rpc("claim", {}),
    async fence(id, lease, key) {
      ownLease(lease);
      return (await rpc("fence", { id, key }))?.fenced === true;
    },
    async finish(id, lease, outcome) {
      ownLease(lease);
      await rpc("settle", { id, outcome });
    },
  };
}
