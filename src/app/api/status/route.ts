import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json(
    { product: "fantasy-cards", registration: "closed" },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
