// Existing isolated Preview only. No Production hook change or public admission.
import { Webhook } from "npm:svix@2.6.1";
import {
  emailHandler,
  messagesFor,
  sendGraph,
  isolatedMailContext,
} from "../docked-auth-email/mail.mjs";
const env = Object.fromEntries(
  [
    "SUPABASE_URL",
    "SEND_EMAIL_HOOK_SECRET",
    "DOCKED_GRAPH_MAIL_ENABLED",
    "DOCKED_ISOLATED_EMAIL_ENABLED",
    "DOCKED_ISOLATED_EMAIL_UNTIL",
    "DOCKED_ISOLATED_EMAIL_ORIGIN",
    "DOCKED_ISOLATED_EMAIL_RECIPIENT",
    "GRAPH_TENANT_ID",
    "GRAPH_CLIENT_ID",
    "GRAPH_PRIVATE_KEY_PEM",
    "GRAPH_CERTIFICATE_PEM",
  ].map((key) => [key, Deno.env.get(key)]),
);
Deno.serve(
  emailHandler({
    verify: (body: string, headers: Record<string, string>) => {
      isolatedMailContext(env);
      if (!env.SEND_EMAIL_HOOK_SECRET?.startsWith("v1,whsec_"))
        throw Error("Hook unavailable");
      return new Webhook(env.SEND_EMAIL_HOOK_SECRET.slice(3)).verify(
        body,
        headers,
      );
    },
    prepare: (payload: unknown) => messagesFor(payload, { isolatedEnv: env }),
    send: (messages: unknown[]) => sendGraph(messages, env, fetch, true),
  }),
);
