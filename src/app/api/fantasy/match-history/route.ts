import { NextResponse } from "next/server";
import { z } from "zod";
import { readHistoricalFixtures } from "@/server/historical-fixtures";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    return NextResponse.json(
      await readHistoricalFixtures(
        Object.fromEntries(new URL(req.url).searchParams),
      ),
      { headers },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "Match history could not be loaded. Check your sport access and retry.",
      },
      { status: e instanceof z.ZodError ? 400 : 403, headers },
    );
  }
}
