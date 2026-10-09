// Operator-only preparation. This is not imported by the application or scheduled.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { Webhook } from "svix";

export const workerUrl =
  "https://pojoymtniryarxxunyvz.supabase.co/functions/v1/docked-auth-email/worker";
export const drainBody = JSON.stringify({
  mode: "production",
  control: "drain",
});

export function validateApproval(approval, now = Date.now()) {
  const expires = Date.parse(approval?.expiresAt);
  if (
    approval?.enabled !== true ||
    approval?.projectRef !== "pojoymtniryarxxunyvz" ||
    approval?.recipient !== "support@docked.com.au" ||
    approval?.serverRecipientMode !== "support-test" ||
    approval?.queueReviewed !== true ||
    typeof approval?.ownerApprovalReference !== "string" ||
    approval.ownerApprovalReference.trim().length < 10 ||
    !Number.isFinite(expires) ||
    expires <= now ||
    expires > now + 15 * 60_000
  )
    throw Error("Owner-only dispatch approval/preflight is absent or expired");
}

// One HTTP request only. Even a timeout can follow Graph acceptance. Never retry here.
export async function dispatchOnce({ approval, secret, fetcher = fetch }) {
  validateApproval(approval);
  if (!/^v1,whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret))
    throw Error("Invalid existing signing-secret format");
  const date = new Date();
  const id = "msg_owner_dispatch_" + randomUUID();
  const signature = new Webhook(secret.slice(3)).sign(id, date, drainBody);
  let response;
  try {
    response = await fetcher(workerUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(55_000),
      headers: {
        "Content-Type": "application/json",
        "webhook-id": id,
        "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
        "webhook-signature": signature,
      },
      body: drainBody,
    });
    if (response.status !== 200) throw Error("Unexpected worker response");
    // Bound even a chunked response; do not log arbitrary server response content.
    const reader = response.body?.getReader();
    if (!reader) throw Error("Missing response");
    let bytes = 0;
    const chunks = [];
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2048) throw Error("Response limit");
        chunks.push(Buffer.from(chunk.value));
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const allowed = [
      "idle",
      "accepted",
      "pending",
      "failed",
      "unknown",
      "unconfirmed",
    ];
    if (
      !Array.isArray(result.states) ||
      result.states.length !== 4 ||
      !result.states.every((state) => allowed.includes(state))
    )
      throw Error("Invalid worker result");
    return {
      states: result.states,
      deliveryVerified: false,
      operatorReviewRequired: result.states.some(
        (state) => state !== "idle" && state !== "accepted",
      ),
      retryAttempted: false,
    };
  } catch {
    // Do not leak upstream errors, signed headers, message content or auth links.
    throw Error(
      "Dispatch outcome unconfirmed; inspect queue status before any further action. No retry attempted.",
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--check")) {
    console.log(
      JSON.stringify({
        prepared: true,
        activated: false,
        endpoint: workerUrl,
        requestsMade: 0,
        secretRead: false,
        instruction:
          "See docs/DOCKED-EMAIL-DISPATCH-DECISION.md; owner approval required before --dispatch-once.",
      }),
    );
    return;
  }
  if (args.length !== 1 || args[0] !== "--dispatch-once")
    throw Error("Use --check or, after approval, --dispatch-once");
  const approval = JSON.parse(
    readFileSync(
      "private-data/production/microsoft365/owner-dispatch-approval.json",
      "utf8",
    ),
  );
  validateApproval(approval); // Fail before reading any signing material.
  const source = readFileSync(
    "private-data/production/microsoft365/hook-disabled.env",
    "utf8",
  );
  const secret = source.match(/SEND_EMAIL_HOOK_SECRET="(v1,whsec_[^"]+)"/)?.[1];
  console.log(JSON.stringify(await dispatchOnce({ approval, secret })));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(() => {
    console.error(
      "Owner dispatch stopped. Verify approval/preflight or inspect queue outcome; no automatic retry. No sensitive details printed.",
    );
    process.exitCode = 1;
  });
}
