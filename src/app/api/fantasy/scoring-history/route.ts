import { NextResponse } from "next/server";
import { z } from "zod";
import { readSportScoringHistory } from "@/server/sport-scoring-history";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    return NextResponse.json(
      await readSportScoringHistory(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers },
    );
  } catch (error) {
    const authentication =
      error instanceof Error &&
      /Authentication required|Privileged MFA required/.test(error.message);
    return NextResponse.json(
      {
        error: "Scoring history is unavailable. Please retry or sign in again.",
      },
      {
        status: error instanceof z.ZodError ? 400 : authentication ? 401 : 503,
        headers,
      },
    );
  }
}
