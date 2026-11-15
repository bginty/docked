import { sameOrigin } from "@/server/auth";
import { founderCredits } from "@/server/founder-credits";
import { CreditsRejected } from "@/server/credits-sandbox-store";
import { ZodError } from "zod";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET() {
  try {
    return Response.json(await founderCredits(), { headers });
  } catch {
    return Response.json(
      { error: "Founder MFA and free beta credit access required." },
      { status: 403, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    return Response.json(await founderCredits(await request.json()), {
      headers,
    });
  } catch (error) {
    const rejected =
      error instanceof CreditsRejected || error instanceof ZodError;
    return Response.json(
      {
        rejected,
        error: rejected
          ? "This request was rejected. Check the member, amount and available allocation."
          : "Issuance is unconfirmed. Retry the same saved request.",
      },
      { status: rejected ? 400 : 503, headers },
    );
  }
}
