import { AdminControls } from "@/components/admin-controls";
import Link from "next/link";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { PageHeading, Notice } from "@/components/ui";
import { ApiForm, Field } from "@/components/forms";
import { editorialSchedules } from "@/core/notifications";
import { SportIcon } from "@/components/sport-icon";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Operations",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  let who;
  try {
    who = await requireRole(["owner", "admin", "analyst", "editor", "auditor"]);
  } catch {
    return (
      <div className="page">
        <PageHeading
          eyebrow="RESTRICTED OPERATIONS"
          title="Verified access required."
        />
        <Notice>
          This workspace requires an assigned staff role and a verified MFA
          session. No admin data is available through the public interface.
        </Notice>
        <div className="actions">
          <Link className="button" href="/login">
            Log in
          </Link>
          <Link className="button ghost" href="/mfa">
            Verify MFA
          </Link>
        </div>
      </div>
    );
  }
  const sql = db();
  const [candidates, jobs, health, audit, flags, strategies, schedules] =
    await Promise.all([
      sql`select id,event_id,status,rejection_reasons from private.candidate_decisions order by decision_at desc limit 30`,
      sql`select kind,state,last_success,duration_ms,failure_reason,attempts,owner_action from private.job_runs order by created_at desc limit 30`,
      sql`select provider,healthy,last_success,credits_remaining,failure_reason from private.source_health`,
      sql`select actor,action,subject,created_at from private.audit_events order by created_at desc limit 30`,
      sql`select key,enabled,reason from private.feature_flags`,
      sql`select id,active,research_approved_at,paper_approved_at,owner_approved_at from private.strategy_versions`,
      sql`select id,config,enabled,last_success,next_run from private.schedules order by id`,
    ]);
  return (
    <div className="page">
      <PageHeading
        eyebrow={`OPERATIONS / ${who.role.toUpperCase()}`}
        title="Evidence. Controls. Accountability."
      />
      <Notice>
        Staff approval cannot bypass data freshness, region restrictions or
        research gates. Auditors have read-only access enforced by every
        mutation handler.
      </Notice>
      <nav aria-label="Operations dashboards" className="actions">
        <Link className="button ghost" href="/admin/research">Research sources and matches</Link>
        <Link className="button ghost" href="/admin/model-performance">
          Model performance
        </Link>
        <Link className="button ghost" href="/admin/daily">
          Daily overview
        </Link>
        <Link className="button ghost" href="/admin/edge-scanner">
          Edge scanner
        </Link>
        <Link className="button ghost" href="/admin/candidate-edges">
          Candidate Edges
        </Link>
        <Link className="button ghost" href="/admin/preview-testers">
          Preview testers
        </Link>
        <Link className="button ghost" href="/admin/community">
          Community operations
        </Link>
        <Link className="button ghost" href="/admin/data-health">
          Data health
        </Link>
        <Link className="button ghost" href="/admin/forward-paper">
          Forward paper
        </Link>
        <Link className="button ghost" href="/admin/strategies">
          Strategy lifecycle
        </Link>
        <Link className="button ghost" href="/admin/analytics">
          Acquisition and retention
        </Link>
      </nav>
      <div className="admin-grid">
        <section className="card">
          <h2>Global controls</h2>
          {flags.map((f) => (
            <p key={f.key}>
              {f.key}: {f.enabled ? "enabled" : "off"} — {f.reason}
            </p>
          ))}
          {["owner", "admin"].includes(who.role) && (
            <>
              <ApiForm
                endpoint="/api/admin"
                action="pause"
                defaults={{ key: "publication" }}
                submit="Pause publication"
              >
                <span />
              </ApiForm>
              <ApiForm
                endpoint="/api/admin"
                action="pause"
                defaults={{ key: "sending" }}
                submit="Pause sending"
              >
                <span />
              </ApiForm>
            </>
          )}
        </section>
        <section className="card">
          <h2 className="sport-context-heading">
            <SportIcon sport="football" size={24} /> Candidate review
          </h2>
          {candidates.length ? (
            candidates.map((c) => (
              <div key={c.id}>
                <p>
                  {c.event_id} · {c.status}
                </p>
                <ApiForm
                  endpoint="/api/admin"
                  action="publish"
                  defaults={{ id: c.id }}
                  submit="Revalidate and publish"
                  disabled={!["owner", "admin", "analyst"].includes(who.role)}
                >
                  <small>{JSON.stringify(c.rejection_reasons)}</small>
                  <label>
                    Evidence category
                    <select name="evidence" defaultValue="forward_paper">
                      <option value="forward_paper">
                        Private forward paper
                      </option>
                      <option value="live_published">
                        Public live · release approval required
                      </option>
                    </select>
                  </label>
                </ApiForm>
              </div>
            ))
          ) : (
            <p>
              No candidates. Feed and validation must be activated before
              evaluation.
            </p>
          )}
          <ApiForm
            endpoint="/api/admin"
            action="withdraw"
            submit="Withdraw publication"
            disabled={!["owner", "admin", "analyst"].includes(who.role)}
          >
            <Field label="Publication ID" name="id" required />
            <Field
              label="Reason · at least 12 characters"
              name="reason"
              required
            />
          </ApiForm>
        </section>
        <section className="card">
          <h2>Source health</h2>
          {health.length ? (
            health.map((h) => (
              <p key={h.provider}>
                {h.provider}: {h.healthy ? "healthy" : "unavailable"} · Credits{" "}
                {h.credits_remaining ?? "unknown"} · {h.failure_reason ?? ""}
              </p>
            ))
          ) : (
            <p>No source has completed ingestion.</p>
          )}
          <h3 className="sport-context-heading">
            <SportIcon sport="basketball" size={22} /> Strategy reviews
          </h3>
          {strategies.length ? (
            strategies.map((s) => (
              <p key={s.id}>
                {s.id} · research{" "}
                {s.research_approved_at ? "approved" : "pending"} · paper{" "}
                {s.paper_approved_at ? "approved" : "pending"} · owner{" "}
                {s.owner_approved_at ? "approved" : "pending"}
              </p>
            ))
          ) : (
            <p>
              No activated strategy. Import approved research evidence before
              activation.
            </p>
          )}
        </section>
        <section className="card">
          <h2>Editorial schedule</h2>
          {schedules.length > 0
            ? schedules.map((s) => (
                <p key={s.id}>
                  {s.id} · {s.enabled ? "enabled" : "off"} · {s.config.hour}:
                  {String(s.config.minute).padStart(2, "0")} {s.config.zone} ·
                  Last success: {s.last_success?.toISOString() ?? "none"} · Next
                  run: {s.next_run?.toISOString() ?? "off"}
                </p>
              ))
            : editorialSchedules.map((s) => (
                <p key={s.key}>
                  {s.key} · {s.cadence} {s.weekday ?? ""} ·{" "}
                  {String(s.hour).padStart(2, "0")}:
                  {String(s.minute).padStart(2, "0")} {s.zone} ·{" "}
                  {s.enabled ? "configured" : "optional / off"}
                </p>
              ))}
          <p>
            Monthly business-day schedule currently means Monday–Friday,
            excluding no public holidays. Local holiday calendar review is
            required.
          </p>
        </section>
        <section className="card">
          <h2>Article editor</h2>
          <ApiForm
            endpoint="/api/admin"
            action="article"
            submit="Save draft"
            disabled={!["owner", "admin", "editor"].includes(who.role)}
          >
            <Field label="Slug" name="id" required />
            <Field label="Title" name="title" required />
            <label>
              Body · plain text
              <textarea name="body" required />
            </label>
            <Field label="Change reason" name="reason" required />
          </ApiForm>
          <ApiForm
            endpoint="/api/admin"
            action="article_transition"
            submit="Apply workflow transition"
            disabled={!["owner", "admin", "editor"].includes(who.role)}
          >
            <Field label="Slug" name="id" required />
            <label>
              Next state
              <select name="to">
                <option>fact_checked</option>
                <option>approved</option>
                <option>published</option>
                <option>archived</option>
              </select>
            </label>
            <Field
              label="Evidence / review reference"
              name="evidence"
              required
            />
          </ApiForm>
        </section>
        <section className="card">
          <h2>Durable jobs</h2>
          {jobs.length ? (
            jobs.map((j, i) => (
              <p key={i}>
                {j.kind} · {j.state} · {j.attempts} attempts ·{" "}
                {j.duration_ms ?? "N/A"} ms · {j.failure_reason ?? "no failure"}{" "}
                · {j.owner_action ?? ""}
              </p>
            ))
          ) : (
            <p>
              No jobs have run. A scheduler trigger does not guarantee
              exactly-once delivery.
            </p>
          )}
          <h3>Audit history</h3>
          {audit.map((a, i) => (
            <p key={i}>
              {a.created_at.toISOString()} · {a.action} · {a.subject}
            </p>
          ))}
        </section>
      </div>
      {["owner", "admin"].includes(who.role) && <AdminControls />}
    </div>
  );
}
