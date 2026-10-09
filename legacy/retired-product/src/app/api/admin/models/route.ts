import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, sameOrigin } from "@/server/auth";
import {
  modelDashboard,
  createModelVersion,
  transitionModelVersion,
  approveFootballPolicy,
  createFootballPolicy,
  setFootballPolicyActive,
} from "@/server/model-ledger";
import { footballModelLifecycle } from "@/core/football-model";
import { rateLimit } from "@/server/db";
const headers = { "Cache-Control": "private, no-store" };
const reason = z.string().min(12).max(2000);
const action = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create_policy"),
      configuration: z.record(z.string(), z.unknown()),
      codeCommit: z.string().regex(/^[a-f0-9]{40}$/),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("set_policy_active"),
      strategyId: z.string().min(1).max(160),
      active: z.boolean(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("create"),
      configuration: z.record(z.string(), z.unknown()),
      codeCommit: z.string().regex(/^[a-f0-9]{40}$/),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("transition"),
      id: z.string().min(1).max(160),
      to: z.enum(footballModelLifecycle),
      reason,
      evidence: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve_policy"),
      strategyId: z.string().min(1).max(160),
      reason,
    })
    .strict(),
]);
export async function GET(request: Request) {
  try {
    await requireRole(["owner", "admin", "analyst", "auditor"]);
    const query = new URL(request.url).searchParams;
    const options = z
      .object({
        modelVersion: z.string().min(1).max(120).optional(),
        windowSeconds: z.coerce
          .number()
          .int()
          .positive()
          .max(604800)
          .optional(),
      })
      .parse({
        modelVersion: query.get("model") ?? undefined,
        windowSeconds: query.get("window") ?? undefined,
      });
    return NextResponse.json(await modelDashboard(options), { headers });
  } catch {
    return NextResponse.json(
      { error: "Verified model staff access required" },
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
    const who = await requireRole(["owner", "admin"]);
    if (!(await rateLimit(`model:${who.user.id}`, 12, 60)))
      return NextResponse.json(
        { error: "Model action limit" },
        { status: 429, headers },
      );
    const reader = request.body?.getReader();
    if (!reader) throw Error("Body required");
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        total += r.value.byteLength;
        if (total > 16384) throw Error("Body limit");
        chunks.push(r.value);
      }
    } finally {
      await reader.cancel();
    }
    const parsed = action.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    const result =
      parsed.action === "create"
        ? await createModelVersion({
            configuration: parsed.configuration,
            codeCommit: parsed.codeCommit,
            reason: parsed.reason,
          })
        : parsed.action === "transition"
          ? await transitionModelVersion({
              id: parsed.id,
              to: parsed.to,
              reason: parsed.reason,
              evidence: parsed.evidence,
            })
          : parsed.action === "create_policy"
            ? await createFootballPolicy({
                configuration: parsed.configuration,
                codeCommit: parsed.codeCommit,
                reason: parsed.reason,
              })
            : parsed.action === "set_policy_active"
              ? await setFootballPolicyActive({
                  strategyId: parsed.strategyId,
                  active: parsed.active,
                  reason: parsed.reason,
                })
              : await approveFootballPolicy({
                  strategyId: parsed.strategyId,
                  reason: parsed.reason,
                });
    return NextResponse.json({ ok: true, result }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Model action denied or evidence incomplete" },
      { status: 403, headers },
    );
  }
}
