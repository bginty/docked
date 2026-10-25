import { requireIdentity } from "@/server/auth";
import { sellerQuote } from "@/core/credits-policy";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    await requireIdentity();
    const price = z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .parse(new URL(req.url).searchParams.get("price"));
    return Response.json(sellerQuote(price), { headers });
  } catch {
    return Response.json(
      { error: "Fee estimate unavailable. Check the price and retry." },
      { status: 400, headers },
    );
  }
}
