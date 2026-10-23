import { NextResponse } from "next/server";
import { z } from "zod";
import { cardPlayerHistory } from "@/server/card-player-history";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const { player, season, sport } = z
      .object({
        player: z.string().regex(/^[A-Za-z0-9:._-]{1,120}$/),
        sport: z
          .enum(["nfl", "basketball", "afl", "nrl", "football", "epl"])
          .optional(),
        season: z.string().min(1).max(40).optional(),
      })
      .parse(Object.fromEntries(new URL(req.url).searchParams));
    return NextResponse.json(await cardPlayerHistory(player, season, sport), {
      headers,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Player history is unavailable. Please retry." },
      { status: e instanceof z.ZodError ? 400 : 503, headers },
    );
  }
}
