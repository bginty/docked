import { NextResponse } from "next/server";
import { scannerWorkerAuthorized } from "@/server/scanner-auth";
import {
  providerTrialEnvironment,
  trialRequestSchema,
} from "@/core/provider-trial";
import { executeProviderTrial } from "@/server/provider-trial";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (
    !providerTrialEnvironment(process.env) ||
    !scannerWorkerAuthorized(
      process.env.PROVIDER_TRIAL_OPERATOR_TOKEN,
      request.headers.get("authorization"),
    )
  )
    return NextResponse.json(
      { error: "Manual trial authentication required" },
      { status: 401 },
    );
  try {
    if (
      new URL(request.url).search ||
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      throw Error("Invalid manual request");
    const reader = request.body?.getReader();
    if (!reader) throw Error("Missing body");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 256) {
        await reader.cancel();
        throw Error("Oversized request");
      }
      chunks.push(part.value);
    }
    const value = trialRequestSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    const result = await executeProviderTrial(
      value.permitId,
      process.env.PROVIDER_TRIAL_OPERATOR_TOKEN!,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Manual trial refused or unavailable; inspect private trial health",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
}
