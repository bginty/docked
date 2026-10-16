import "server-only";
import { z } from "zod";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";
import { healthOrigin } from "../core/owner-health";
import { boundedCommunityBody } from "../core/community-social";
import manifest from "../../config/hosted-production.json";

export async function checkOwnerHealth(input: unknown) {
  const who = await requireRole(["owner"]);
  const { request } = z
    .object({ request: z.string().uuid() })
    .strict()
    .parse(input);
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Health scope unavailable");
  if (!(await rateLimit(`owner-health:${who.user.id}`, 3, 60)))
    throw Error("Health rate limit");
  const origin = healthOrigin(
    process.env.SITE_URL,
    process.env.VERCEL === "1" || process.env.APP_ENV === "production",
  );
  const rows = await Promise.all(
    (["api", "web"] as const).map(async (service) => {
      const start = performance.now();
      let status: "passed" | "failed" = "failed",
        code = "timeout_or_network",
        statusCode: number | null = null;
      try {
        const response = await fetch(
          origin + (service === "api" ? "/api/beta-release" : "/app/login"),
          {
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(5000),
            headers: {
              Accept: service === "api" ? "application/json" : "text/html",
            },
          },
        );
        statusCode = response.status;
        const text = new TextDecoder().decode(
          await boundedCommunityBody(
            response,
            service === "api" ? 8192 : 512000,
          ),
        );
        let matches = false;
        if (service === "api") {
          const value = JSON.parse(text);
          matches =
            response.status === 200 &&
            value.projectRef === manifest.supabaseProjectRef &&
            value.publicRegistration === false &&
            value.invitedAuthentication === true &&
            /^[a-f0-9]{40}$/.test(value.commit ?? "");
        } else
          matches =
            response.status === 200 &&
            /docked/i.test(text) &&
            /sign in|log in/i.test(text);
        status = matches ? "passed" : "failed";
        code = matches ? "matched" : "unexpected_response";
      } catch {
        code =
          statusCode === null ? "timeout_or_network" : "unexpected_response";
      }
      return {
        service,
        status,
        code,
        statusCode,
        durationMs: Math.min(15000, Math.round(performance.now() - start)),
      };
    }),
  );
  await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    await tx`select private.owner_health_record(${request}::uuid,${tx.json(rows)}::jsonb)`;
  });
  return { recorded: true };
}
