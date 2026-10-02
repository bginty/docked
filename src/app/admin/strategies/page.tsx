import Link from "next/link";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { PageHeading, Notice } from "@/components/ui";
import { ApiForm, Field } from "@/components/forms";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Strategy lifecycle",
  robots: { index: false, follow: false },
};
export default async function Strategies() {
  let who;
  try {
    who = await requireRole(["owner", "admin", "analyst", "auditor"]);
  } catch {
    return (
      <div className="page">
        <PageHeading
          eyebrow="STRATEGY GOVERNANCE"
          title="Verified access required."
        />
        <Notice>Staff role and MFA required.</Notice>
        <Link href="/login">Log in</Link>
      </div>
    );
  }
  const sql = db();
  const [rows, history] = await Promise.all([
    sql`select id,lifecycle,config_hash,code_commit,frozen_at from private.strategy_versions order by state_changed_at desc`,
    sql`select strategy_id,from_state,to_state,actor,created_at,reason,validation_run_id from private.strategy_transitions order by created_at desc limit 50`,
  ]);
  const mayEdit = ["owner", "admin"].includes(who.role);
  return (
    <div className="page">
      <PageHeading
        eyebrow="STRATEGY GOVERNANCE"
        title="Freeze before observing outcomes."
      />
      <Notice>
        DRAFT → RESEARCH → VALIDATED → FROZEN_FOR_FORWARD_PAPER → FORWARD_PAPER
        → APPROVED_FOR_LIVE → RETIRED. Every change records actor, time, exact
        commit, configuration and report reference. A material change after
        freezing requires a new strategy version.
      </Notice>
      <p>
        <Link href="/admin">Operations</Link> ·{" "}
        <Link href="/admin/forward-paper">Forward paper</Link>
      </p>
      <div className="admin-grid">
        <section className="card">
          <h2>Registered strategies</h2>
          {rows.length ? (
            rows.map((r) => (
              <div key={r.id}>
                <h3>
                  {r.id} · {r.lifecycle}
                </h3>
                <p>
                  Configuration hash: <code>{r.config_hash}</code>
                </p>
                <p>
                  Code: <code>{r.code_commit ?? "not recorded"}</code>
                </p>
                <p>Frozen: {r.frozen_at?.toISOString() ?? "not frozen"}</p>
              </div>
            ))
          ) : (
            <p>No strategy registered. No validation claim has been made.</p>
          )}
        </section>
        {mayEdit && (
          <>
            <section className="card">
              <h2>Create a draft</h2>
              <p>
                This creates a version of the installed reviewed algorithm.
                Parameter changes require a new reviewed code/configuration
                artifact and fresh research.
              </p>
              <ApiForm endpoint="/api/admin" action="strategy_create">
                <Field name="id" label="New strategy ID" required />
                <Field
                  name="codeCommit"
                  label="Exact 40-character code commit"
                  required
                />
                <Field
                  name="reason"
                  label="Reason · at least 12 characters"
                  required
                />
              </ApiForm>
            </section>
            <section className="card">
              <h2>Gated transition</h2>
              <ApiForm endpoint="/api/admin" action="strategy_transition">
                <Field name="id" label="Strategy ID" required />
                <label>
                  Next lifecycle state
                  <select name="to">
                    {[
                      "RESEARCH",
                      "VALIDATED",
                      "FROZEN_FOR_FORWARD_PAPER",
                      "FORWARD_PAPER",
                      "APPROVED_FOR_LIVE",
                      "RETIRED",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <Field name="codeCommit" label="Exact code commit" required />
                <Field
                  name="validationRun"
                  label="Validation run UUID · required for validation and live approval"
                />
                <Field
                  name="reason"
                  label="Review reason and evidence"
                  required
                />
              </ApiForm>
            </section>
          </>
        )}
        <section className="card">
          <h2>Immutable transition history</h2>
          {history.length ? (
            history.map((h, i) => (
              <p key={i}>
                {h.created_at.toISOString()} · {h.strategy_id} · {h.from_state}{" "}
                → {h.to_state} · {h.reason}
              </p>
            ))
          ) : (
            <p>No transitions recorded.</p>
          )}
        </section>
      </div>
    </div>
  );
}
