import {
  emailHandler,
  messagesFor,
  projectUrl,
  productionRecipientAllowed,
} from "./mail.mjs";
import { queueJobs, queueRpc, drainOne } from "./queue.mjs";

export function hookRouter(env, verify, suppliedRpc, fetcher = fetch) {
  const rpc = (...args) => (suppliedRpc ?? queueRpc(env, fetcher))(...args);
  const enqueue = async (messages, mode, diagnosticId = undefined) => {
    const jobs = await queueJobs(
      messages,
      env.SEND_EMAIL_HOOK_SECRET,
      mode,
      diagnosticId,
    );
    return { jobs: await rpc("enqueue", { mode, jobs }) };
  };
  const production = emailHandler({
    verify,
    prepare: (payload) =>
      messagesFor(payload, {
        allowInvites: env.DOCKED_GRAPH_INVITES_READY === "true",
        betaOrigin: env.DOCKED_BETA_AUTH_ORIGIN,
      }),
    send: async (messages) => {
      if (
        env.SUPABASE_URL !== projectUrl ||
        env.DOCKED_GRAPH_MAIL_ENABLED !== "true" ||
        env.DOCKED_GRAPH_WORKER_READY !== "true"
      )
        throw Error("Production mail disabled");
      if (
        !messages.every(
          (message) =>
            message.toRecipients?.length === 1 &&
            productionRecipientAllowed(
              message.toRecipients[0].emailAddress?.address,
              env,
            ),
        )
      )
        throw Error("Production recipient unavailable");
      await enqueue(messages, "production");
    },
  });
  const controlled = emailHandler({
    verify,
    includeResult: true,
    prepare: (payload) => {
      if (
        env.SUPABASE_URL !== projectUrl ||
        env.DOCKED_GRAPH_TEST_ENABLED !== "true" ||
        payload?.mode !== "controlled"
      )
        throw Error("Controlled mode unavailable");
      if (payload.control === "enqueue")
        return {
          action: "enqueue",
          messages: messagesFor(payload.auth, {
            allowInvites: env.DOCKED_GRAPH_INVITES_READY === "true",
            betaOrigin: env.DOCKED_BETA_AUTH_ORIGIN,
          }),
        };
      if (
        payload.control === "diagnostic" &&
        /^[a-f0-9]{64}$/.test(payload.id ?? "")
      )
        return {
          action: "enqueue",
          diagnosticId: payload.id,
          messages: [
            {
              subject:
                "Docked hosted email queue check " + payload.id.slice(0, 12),
              body: {
                contentType: "Text",
                content:
                  "This is the authorized hosted queue delivery check for Docked Production Email.\n\nReference: " +
                  payload.id +
                  "\n\nNo account action is required. Please confirm Inbox receipt. Public signup and automatic production email remain disabled. This message contains no verification link or attachment.\n\nDocked — Ginty United Investments Pty Ltd\nABN 78 606 187 106",
              },
              toRecipients: [
                { emailAddress: { address: "support@docked.com.au" } },
              ],
            },
          ],
        };
      if (
        !["drain", "status"].includes(payload.control) ||
        !/^[a-f0-9]{64}$/.test(payload.id ?? "")
      )
        throw Error("Invalid control request");
      return { action: payload.control, id: payload.id };
    },
    send: async (command) => {
      if (command.action === "enqueue")
        return await enqueue(
          command.messages,
          "controlled",
          command.diagnosticId,
        );
      if (command.action === "status")
        return await rpc("status", { mode: "controlled", id: command.id });
      return await drainOne({
        env,
        mode: "controlled",
        rpc,
        id: command.id,
        fetcher,
      });
    },
  });
  // Scheduler activation is separately gated. Auth signatures cannot be replayed
  // as worker commands because their signed bodies lack this control schema.
  const worker = emailHandler({
    verify,
    includeResult: true,
    prepare: (payload) => {
      if (
        env.DOCKED_GRAPH_MAIL_ENABLED !== "true" ||
        env.DOCKED_GRAPH_WORKER_READY !== "true" ||
        payload?.mode !== "production" ||
        payload.control !== "drain"
      )
        throw Error("Production worker disabled");
      return payload;
    },
    send: async () => {
      // Four independent leases bound runtime to one provider timeout budget.
      // A failed/ambiguous job never triggers an automatic submission retry.
      const outcomes = await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          drainOne({ env, mode: "production", rpc, fetcher }),
        ),
      );
      return {
        states: outcomes.map((r) =>
          r.status === "fulfilled" ? r.value.state : "unconfirmed",
        ),
      };
    },
  });
  return (request) => {
    const path = new URL(request.url).pathname;
    if (
      path === "/docked-auth-email/worker" ||
      path === "/functions/v1/docked-auth-email/worker"
    )
      return worker(request);
    if (
      path === "/docked-auth-email/control" ||
      path === "/functions/v1/docked-auth-email/control"
    )
      return controlled(request);
    if (
      path === "/docked-auth-email" ||
      path === "/functions/v1/docked-auth-email"
    )
      return production(request);
    return Promise.resolve(new Response(null, { status: 404 }));
  };
}
