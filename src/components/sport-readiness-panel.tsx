"use client";
import { useEffect, useRef, useState } from "react";
import { evaluateReadiness } from "../core/sport-readiness";
import type { SportReadinessReport } from "../core/sport-readiness-report";
import { sportConfigurations } from "../core/sport-configuration";
export function SportReadinessPanel() {
  const [report, setReport] = useState<SportReadinessReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const inFlight = useRef(false);
  async function load(signal?: AbortSignal) {
    try {
      const r = await fetch("/api/admin/sports-readiness", {
        cache: "no-store",
        signal,
      });
      if (!r.ok)
        throw Error(
          "Readiness could not load. Check owner access and the readiness migration, then retry.",
        );
      const next = await r.json();
      if (!signal?.aborted) {
        setReport(next);
        setError("");
      }
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : "Readiness unavailable");
    }
  }
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, []);
  async function decide(packageHash: string, action: "approve" | "suspend") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/sports-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageHash,
          action,
          reason,
          requestId: crypto.randomUUID(),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setReport(body);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision unavailable");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="admin-workspace sport-readiness"
      aria-label="Hosted sport evidence"
    >
      <h2>Roster and release evidence</h2>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="button ghost" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {!report && !error && (
        <p role="status">Loading verified operations data…</p>
      )}
      {report && (
        <>
          <p>
            Read at{" "}
            {new Date(report.generatedAt)
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)}{" "}
            UTC. Catalogue rows are not proof of current eligibility.
          </p>
          <div className="admin-records">
            {Object.values(sportConfigurations).map((s) => {
              const rows = report.rosters.filter((r) => r.sport === s.id),
                count = report.catalogue
                  .filter((r) => r.sport === s.id)
                  .reduce((n, r) => n + Number(r.count), 0);
              return (
                <article key={s.id} className="admin-workspace-panel">
                  <h3>{s.label}</h3>
                  <p>
                    {count.toLocaleString()} catalogue records ·{" "}
                    {s.publicEnabled
                      ? "Existing member release"
                      : "Live activation gated"}
                  </p>
                  {!rows.length ? (
                    <p>No reviewed roster evidence in this registry.</p>
                  ) : (
                    rows.map((r) => (
                      <div key={`${r.season}:${r.provider}`}>
                        <p>
                          {r.season} · {r.provider}
                        </p>
                        <p>
                          {r.current_reviewed}/{r.reviewed} current reviewed
                          rows · {r.quarantined} quarantined · {r.expired}{" "}
                          expired · {r.missing_numbers} missing numbers
                        </p>
                        <p>
                          Last roster observation:{" "}
                          {new Date(r.last_observed).toISOString()}
                        </p>
                      </div>
                    ))
                  )}
                  <details>
                    <summary>Positions and roster issues</summary>
                    <ul>
                      {report.catalogue
                        .filter((r) => r.sport === s.id)
                        .map((r) => (
                          <li key={`${r.position}:${r.status}`}>
                            {r.position}: {r.count} ({r.status})
                          </li>
                        ))}
                      {report.issues
                        .filter((r) => r.sport === s.id)
                        .map((r, i) => (
                          <li key={i}>
                            {r.player_id ?? "Unmapped identity"} ·{" "}
                            {r.reasons.join(" · ") ||
                              "Review number or expired evidence"}{" "}
                            · {r.season}
                          </li>
                        ))}
                    </ul>
                    <p>
                      Latest {report.issueLimit} flagged observations maximum.
                      Full evidence remains in the operator registry.
                    </p>
                  </details>
                </article>
              );
            })}
          </div>
          <details>
            <summary>Data delivery jobs</summary>
            {report.jobs.length ? (
              <ul>
                {report.jobs.map((j) => (
                  <li key={`${j.provider}:${j.state}`}>
                    {j.provider} · {j.state}: {j.count} · Last success:{" "}
                    {j.last_success ?? "No successful fetch recorded"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No jobs recorded in the shared fetch queue. An external push
                feed requires its own successful import evidence.
              </p>
            )}
          </details>
          <h3>Release packages</h3>
          <p>
            Approval records a decision for this exact package. Deployment and
            live issuance remain separate controlled actions.
          </p>
          {!report.packages.length && (
            <p>
              No release package staged. Source, roster, rules, supply and
              hosted evidence are still required.
            </p>
          )}
          {report.packages.length > 0 && (
            <label>
              Decision reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                minLength={10}
              />
            </label>
          )}
          {report.packages.map((p) => {
            const status = evaluateReadiness(
              p.body,
              new Date().toISOString(),
              p.hash,
              p.decision,
            );
            return (
              <article key={p.hash} className="admin-workspace-panel">
                <h4>
                  {sportConfigurations[p.body.sport].label} · {p.body.season} ·{" "}
                  {p.body.mode === "OPEN" ? "All-Star" : "Traditional"}
                </h4>
                <p>
                  {status.readyForRelease
                    ? "Approved package; deployment still required"
                    : "Not ready for release"}
                </p>
                <ul>
                  {status.gates.map((g) => (
                    <li key={g.gate}>
                      {g.passed ? "✓" : "—"} {g.label}: {g.reason}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Package identity</summary>
                  <p style={{ overflowWrap: "anywhere" }}>{p.hash}</p>
                  <p>
                    {p.body.formatVersion} · {p.body.scoringVersion} ·{" "}
                    {p.body.provider}
                  </p>
                </details>
                <button
                  className="button"
                  disabled={
                    busy ||
                    reason.trim().length < 10 ||
                    !status.readyForOwnerReview
                  }
                  onClick={() => void decide(p.hash, "approve")}
                >
                  Approve release package
                </button>
                <button
                  className="button ghost"
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => void decide(p.hash, "suspend")}
                >
                  Suspend approval
                </button>
              </article>
            );
          })}
        </>
      )}
    </section>
  );
}
