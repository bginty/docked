import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, sameOrigin } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
import { publish } from "@/server/publication";
import { adminOperation } from "@/server/admin-operations";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const body = await request.json();
    const who = await requireRole(["owner", "admin", "analyst", "editor"]);
    if (!(await rateLimit(`admin:${who.user.id}`, 20)))
      throw new Error("Rate limit");
    const sql = db();
    if (body.action === "publish") {
      const id = await publish(
        z.string().uuid().parse(body.id),
        z.enum(["forward_paper", "live_published"]).parse(body.evidence),
      );
      return NextResponse.json({ ok: true, message: `Published ${id}` });
    }
    if (body.action === "withdraw") {
      await requireRole(["owner", "admin", "analyst"]);
      const id = z.string().uuid().parse(body.id),
        reason = z.string().min(12).max(1000).parse(body.reason);
      await sql`insert into private.tip_status_events(tip_id,status,reason,actor) values(${id},'withdrawn',${reason},${who.user.id})`;
      return NextResponse.json({
        ok: true,
        message: "Withdrawn. Original benchmark still settles.",
      });
    }
    if (body.action === "pause") {
      await requireRole(["owner", "admin"]);
      const key = z.enum(["publication", "sending"]).parse(body.key);
      await sql.begin(async (tx) => {
        await tx`update private.feature_flags set enabled=false,reason='Owner/admin pause',updated_by=${who.user.id},updated_at=now() where key=${key}`;
        await tx`insert into private.audit_events(actor,action,subject) values(${who.user.id},'pause',${key})`;
      });
      return NextResponse.json({ ok: true, message: `${key} paused.` });
    }
    if (body.action === "article") {
      await requireRole(["owner", "admin", "editor"]);
      const v = z
        .object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          title: z.string().min(5).max(160),
          body: z.string().min(80).max(30000),
          reason: z.string().min(12).max(1000),
        })
        .parse(body);
      await sql.begin(async (tx) => {
        const old =
          await tx`select * from private.articles where id=${v.id} for update`;
        const revision = (old[0]?.revision ?? 0) + 1;
        await tx`insert into private.articles(id,title,body,revision,actor) values(${v.id},${v.title},${v.body},${revision},${who.user.id}) on conflict(id) do update set title=excluded.title,body=excluded.body,status='draft',revision=excluded.revision,actor=excluded.actor`;
        await tx`insert into private.article_revisions(article_id,revision,payload,actor,reason) values(${v.id},${revision},${tx.json({ title: v.title, body: v.body })},${who.user.id},${v.reason})`;
      });
      return NextResponse.json({
        ok: true,
        message: "Article draft saved for fact-checking.",
      });
    }
    if (body.action === "article_transition") {
      await requireRole(["owner", "admin", "editor"]);
      const v = z
        .object({
          id: z.string(),
          to: z.enum([
            "fact_checked",
            "approved",
            "scheduled",
            "published",
            "corrected",
            "archived",
          ]),
          evidence: z.string().min(12),
          scheduledAt: z.string().datetime().optional(),
        })
        .parse(body);
      await sql.begin(async (tx) => {
        const rows =
          await tx`select * from private.articles where id=${v.id} for update`;
        const transitions: Record<string, string[]> = {
          draft: ["fact_checked"],
          fact_checked: ["approved"],
          approved: ["scheduled", "published"],
          scheduled: ["published"],
          published: ["corrected", "archived"],
          corrected: ["archived"],
        };
        if (!rows[0] || !transitions[rows[0].status]?.includes(v.to))
          throw new Error("Invalid transition");
        if (v.to === "scheduled" && !v.scheduledAt)
          throw new Error("Schedule required");
        await tx`update private.articles set status=${v.to},evidence=${tx.json([v.evidence])},scheduled_at=${v.scheduledAt ?? null},published_at=case when ${v.to}='published' then now() else published_at end where id=${v.id}`;
        await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},${"article_" + v.to},${v.id},${tx.json({ evidence: v.evidence })})`;
      });
      return NextResponse.json({ ok: true, message: "Workflow updated." });
    }
    if (
      [
        "schedule",
        "suspend_region",
        "suspend_provider",
        "strategy_activate",
        "strategy_paper_start",
        "correction",
        "retry_job",
      ].includes(body.action)
    )
      return NextResponse.json({
        ok: true,
        message: await adminOperation(body),
      });
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      {
        error:
          "Operation denied or safety checks failed. Check role, MFA, inputs, and launch gates.",
      },
      { status: 403 },
    );
  }
}
