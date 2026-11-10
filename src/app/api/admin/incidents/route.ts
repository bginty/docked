import { z } from "zod";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { operationalIncidents } from "@/server/operational-incidents";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const denied = () =>
  Response.json(
    {
      error:
        "Incident review unavailable. Check your owner session and reload before retrying.",
    },
    { status: 403, headers },
  );
export async function GET() {
  try {
    return Response.json(await operationalIncidents(), { headers });
  } catch {
    return denied();
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return denied();
  try {
    const input = z
      .discriminatedUnion("action", [
        z.object({ action: z.enum(["refresh", "drill"]) }).strict(),
        z
          .object({
            action: z.literal("report"),
            code: z.enum([
              "security_auth_incident",
              "database_unavailable",
              "ingestion_failure",
              "unresolved_operational_exception",
            ]),
            reason: z.string().trim().min(12).max(600),
          })
          .strict(),
        z
          .object({
            action: z.enum(["acknowledge", "resolve", "confirm_delivery"]),
            code: z.string().regex(/^[a-z_]{3,80}$/),
            revision: z.number().int().positive(),
            reason: z.string().trim().min(12).max(600),
          })
          .strict(),
      ])
      .parse(
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(request, 4096)),
        ),
      );
    const { action, ...payload } = input;
    return Response.json(await operationalIncidents(action, payload), {
      headers,
    });
  } catch {
    return denied();
  }
}
