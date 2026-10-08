import { Webhook } from "npm:svix@2.6.1";
import { emailHandler, sendGraph } from "./mail.mjs";

// The gateway JWT check is replaced ONLY by mandatory signed Auth-hook verification.
// No CORS, service-role bearer fallback, arbitrary sender or public mail endpoint.
Deno.serve(
  emailHandler({
    verify: (body: string, headers: Record<string, string>) => {
      const secret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
      if (!secret?.startsWith("v1,whsec_"))
        throw Error("Hook secret unavailable");
      return new Webhook(secret.slice(3)).verify(body, headers);
    },
    send: (messages: unknown[]) =>
      sendGraph(messages, {
        SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
        DOCKED_GRAPH_MAIL_ENABLED: Deno.env.get("DOCKED_GRAPH_MAIL_ENABLED"),
        GRAPH_TENANT_ID: Deno.env.get("GRAPH_TENANT_ID"),
        GRAPH_CLIENT_ID: Deno.env.get("GRAPH_CLIENT_ID"),
        GRAPH_PRIVATE_KEY_PEM: Deno.env.get("GRAPH_PRIVATE_KEY_PEM"),
        GRAPH_CERTIFICATE_PEM: Deno.env.get("GRAPH_CERTIFICATE_PEM"),
      }),
  }),
);
