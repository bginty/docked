import { NextResponse } from "next/server";
import { z } from "zod";
import { monitoredMarkets } from "@/server/market-data";
export const dynamic = "force-dynamic";
const query = z
  .object({
    window: z.enum(["today", "upcoming", "weekend"]).default("upcoming"),
    limit: z.coerce.number().int().min(1).max(30).default(8),
    sport: z
      .enum([
        "football",
        "basketball",
        "nfl",
        "tennis",
        "cricket",
        "motorsport",
        "horse-racing",
        "baseball",
        "ice-hockey",
        "afl",
      ])
      .optional(),
    competition: z
      .string()
      .regex(/^[a-z0-9_]{1,100}$/)
      .optional(),
  })
  .strict();
export async function GET(request: Request) {
  const value = query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!value.success)
    return NextResponse.json(
      { ok: false, error: "Invalid market-data query" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  return NextResponse.json(await monitoredMarkets(value.data), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
