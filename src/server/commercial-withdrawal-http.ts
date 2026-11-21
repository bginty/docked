import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { sameOrigin } from "./auth";
import { boundedCommunityBody } from "../core/community-social";
import { CommercialWithdrawalRejected } from "../core/commercial-withdrawals";
import { CommercialKycProviderError } from "./commercial-kyc-provider";

export const withdrawalHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export function withdrawalError(error: unknown) {
  const authentication =
    error instanceof Error && error.message === "Authentication required";
  const forbidden =
    error instanceof Error &&
    ["Privileged MFA required", "Role denied", "Origin denied"].includes(
      error.message,
    );
  const rejected =
    error instanceof CommercialWithdrawalRejected ||
    error instanceof ZodError ||
    authentication ||
    forbidden;
  return NextResponse.json(
    {
      error: authentication
        ? "Sign in to continue."
        : forbidden
          ? "This action requires the correct account and authentication."
          : error instanceof CommercialWithdrawalRejected
            ? error.message
            : error instanceof ZodError
              ? "Check the details and try again."
              : error instanceof CommercialKycProviderError
                ? "Identity verification could not be confirmed. Please retry shortly."
                : "The outcome could not be confirmed. Retry the same request or check your withdrawal history.",
      outcome: rejected ? "rejected" : "unknown",
    },
    {
      status: authentication ? 401 : forbidden ? 403 : rejected ? 409 : 503,
      headers: withdrawalHeaders,
    },
  );
}

export async function withdrawalGet(handler: () => Promise<unknown>) {
  try {
    return NextResponse.json(await handler(), { headers: withdrawalHeaders });
  } catch (error) {
    return withdrawalError(error);
  }
}

export async function withdrawalPost(
  request: Request,
  handler: (input: unknown) => Promise<unknown>,
) {
  if (!sameOrigin(request)) return withdrawalError(Error("Origin denied"));
  try {
    if (
      !(request.headers.get("content-type") ?? "")
        .toLowerCase()
        .startsWith("application/json")
    )
      throw new CommercialWithdrawalRejected("A JSON request is required.");
    const input: unknown = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 16384)),
    );
    return NextResponse.json(await handler(input), {
      headers: withdrawalHeaders,
    });
  } catch (error) {
    return withdrawalError(error);
  }
}
