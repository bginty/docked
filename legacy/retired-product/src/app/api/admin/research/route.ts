import { NextResponse } from "next/server";
import { requireRole, sameOrigin } from "@/server/auth";
import { rateLimit } from "@/server/db";
import {
  researchDashboard,
  matchResearch,
  mutateResearch,
} from "@/server/research-engine";
import { researchId } from "@/core/research-engine";
import { z } from "zod";
const headers = { "Cache-Control": "private, no-store" };
const roles = ["owner", "admin", "analyst", "editor", "auditor"];
export async function GET(request: Request) {
  try {
    await requireRole(roles);
    const q = new URL(request.url).searchParams;
    const event = q.get("event"),
      policy = q.get("policy"),
      snapshot = q.get("snapshot");
    return NextResponse.json(
      event
        ? await matchResearch(
            researchId.parse(event),
            policy ? z.uuid().parse(policy) : undefined,
            snapshot ? z.uuid().parse(snapshot) : undefined,
          )
        : await researchDashboard(),
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Verified research staff access required" },
      { status: 403, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const who = await requireRole(["owner", "admin", "analyst", "editor"]);
    if (!(await rateLimit(`research:${who.user.id}`, 20, 60)))
      return NextResponse.json(
        { error: "Research action limit" },
        { status: 429, headers },
      );
    const reader = request.body?.getReader();
    if (!reader) throw Error("Body required");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.byteLength;
        if (size > 32768) throw Error("Body limit");
        chunks.push(r.value);
      }
    } finally {
      await reader.cancel();
    }
    const result = await mutateResearch(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    return NextResponse.json({ ok: true, result }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Research action denied or evidence incomplete" },
      { status: 403, headers },
    );
  }
}
