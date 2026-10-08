import { Webhook } from "npm:svix@2.6.1";
import { hookRouter } from "./router.mjs";

const env = Object.fromEntries(
  [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SEND_EMAIL_HOOK_SECRET",
    "DOCKED_GRAPH_MAIL_ENABLED",
    "DOCKED_GRAPH_WORKER_READY",
    "DOCKED_GRAPH_TEST_ENABLED",
    "DOCKED_GRAPH_INVITES_READY",
    "DOCKED_GRAPH_RECIPIENT_MODE",
    "DOCKED_GRAPH_BETA_RECIPIENTS",
    "DOCKED_BETA_AUTH_ORIGIN",
    "GRAPH_TENANT_ID",
    "GRAPH_CLIENT_ID",
    "GRAPH_PRIVATE_KEY_PEM",
    "GRAPH_CERTIFICATE_PEM",
  ].map((key) => [key, Deno.env.get(key)]),
);

// Gateway JWT is replaced only by mandatory signature verification for every path.
Deno.serve(
  hookRouter(env, (body: string, headers: Record<string, string>) => {
    const secret = env.SEND_EMAIL_HOOK_SECRET;
    if (!secret?.startsWith("v1,whsec_"))
      throw Error("Hook secret unavailable");
    return new Webhook(secret.slice(3)).verify(body, headers);
  }),
);
