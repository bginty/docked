"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiForm, Field } from "./forms";
import type { ScannerCandidate } from "@/core/edge-scanner";
export function ManualCandidateForm() {
  return (
    <details className="app-panel">
      <summary>Evaluate a canonical market manually</summary>
      <p>
        Provide existing IDs only. The server loads the current source evidence
        and strategy. No probability, odds or result can be entered here.
      </p>
      <ApiForm
        endpoint="/api/admin/scanner"
        action="manual_candidate"
        submit="Evaluate for research review"
      >
        <Field name="marketId" label="Canonical market ID" required />
        <Field name="selection" label="Canonical selection" required />
        <Field name="strategyId" label="Installed strategy version" required />
        <Field
          name="regionPolicyId"
          label="Approved region policy UUID"
          required
        />
        <label>
          Purpose
          <select name="purpose" defaultValue="research">
            <option value="research">Research — no publication</option>
            <option value="paper">
              Forward paper — all validation gates required
            </option>
            <option value="live">
              Live — approved strategy and publication gates required
            </option>
          </select>
        </label>
        <label>
          Review reason
          <textarea name="reason" minLength={12} maxLength={1000} required />
        </label>
      </ApiForm>
    </details>
  );
}
export function CandidateReview({
  candidate,
}: {
  candidate: ScannerCandidate;
}) {
  if (!["CANDIDATE", "NEEDS_REVIEW"].includes(candidate.status))
    return (
      <p className="form-help">
        This record is {candidate.status.toLowerCase().replaceAll("_", " ")}.
        Its original evidence is retained; approval controls are closed.
      </p>
    );
  return (
    <div className="admin-grid">
      <section className="app-panel">
        <h2>Revalidate before approval</h2>
        <p>
          {candidate.purpose === "research"
            ? "Approval records a research review only. It does not publish an official Edge."
            : "Approval must recheck the current quote, minimum price, event cutoff, model and every existing publication gate."}
        </p>
        <ApiForm
          endpoint="/api/admin/scanner"
          action="approve"
          defaults={{ id: candidate.id }}
          submit={
            candidate.purpose === "research"
              ? "Revalidate and approve research"
              : "Revalidate through publication gates"
          }
        >
          <label>
            Approval reason
            <textarea name="reason" minLength={12} maxLength={1000} required />
          </label>
        </ApiForm>
      </section>
      <section className="app-panel">
        <h2>Reject candidate</h2>
        <ApiForm
          endpoint="/api/admin/scanner"
          action="reject"
          defaults={{ id: candidate.id }}
          submit="Record rejection"
        >
          <label>
            Reason category
            <select name="category" defaultValue="data_concern">
              {[
                "data_concern",
                "market_moved",
                "model_concern",
                "duplicate",
                "market_rule_concern",
                "editorial_operational",
                "other",
              ].map((reason) => (
                <option key={reason} value={reason}>
                  {reason.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Details
            <textarea name="reason" minLength={3} maxLength={1000} required />
          </label>
        </ApiForm>
      </section>
    </div>
  );
}
export function ScannerScheduleForm() {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  useEffect(() => setReady(true), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    const form = new FormData(event.currentTarget),
      schedule: Record<string, unknown> = {};
    for (const name of [
      "id",
      "provider",
      "sport",
      "competition",
      "strategyId",
      "regionPolicyId",
      "purpose",
    ])
      schedule[name] = form.get(name);
    for (const name of [
      "intervalSeconds",
      "nearEventSeconds",
      "nearIntervalSeconds",
      "horizonSeconds",
      "minQuotaRemaining",
    ])
      schedule[name] = Number(form.get(name));
    schedule.enabled = form.get("enabled") === "on";
    setBusy(true);
    try {
      const response = await fetch("/api/admin/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          schedule,
          reason: form.get("reason"),
        }),
      });
      const result = await response.json();
      setMessage(
        result.message ??
          result.error ??
          (result.ok ? "Schedule saved." : "Schedule not confirmed."),
      );
      if (response.ok && result.ok) router.refresh();
    } catch {
      setMessage("Schedule service unavailable. No change has been confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="app-panel">
      <summary>Configure an audited scanner schedule</summary>
      <p>
        Scans inspect cached approved data. Global scanner, source permissions
        and strategy gates remain independent. Saving a schedule never enables
        publication.
      </p>
      <form
        method="post"
        action="/api/admin/scanner"
        onSubmit={submit}
        className="form-stack"
        data-api-ready={ready ? "true" : "false"}
      >
        <div className="scanner-form-grid">
          <Field label="Schedule ID" name="id" required />
          <label>
            Provider
            <select name="provider" defaultValue="the-odds-api">
              <option value="the-odds-api">The Odds API</option>
              <option value="odds-papi">OddsPapi</option>
            </select>
          </label>
          <Field label="Canonical sport ID" name="sport" required />
          <Field label="Canonical competition ID" name="competition" required />
          <Field
            label="Installed strategy version"
            name="strategyId"
            required
          />
          <Field
            label="Approved region policy UUID"
            name="regionPolicyId"
            required
          />
          <label>
            Purpose
            <select name="purpose" defaultValue="research">
              <option value="research">Research</option>
              <option value="paper">Forward paper</option>
              <option value="live">Gated live review</option>
            </select>
          </label>
          {[
            ["intervalSeconds", "Base interval (seconds)", 300, 86400, 900],
            [
              "nearEventSeconds",
              "Near-event window (seconds)",
              600,
              86400,
              3600,
            ],
            [
              "nearIntervalSeconds",
              "Near-event interval (seconds)",
              60,
              86400,
              300,
            ],
            ["horizonSeconds", "Event horizon (seconds)", 600, 604800, 86400],
            [
              "minQuotaRemaining",
              "Minimum known quota for faster cadence",
              0,
              100000000,
              100,
            ],
          ].map(([name, label, min, max, value]) => (
            <label key={name}>
              {label}
              <input
                name={String(name)}
                type="number"
                min={Number(min)}
                max={Number(max)}
                defaultValue={Number(value)}
                step={1}
                required
              />
            </label>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" name="enabled" /> Enable this schedule (global
          pause still applies)
        </label>
        <label>
          Configuration reason
          <textarea name="reason" minLength={12} maxLength={1000} required />
        </label>
        <button className="button" disabled={!ready || busy}>
          {busy ? "Saving…" : "Save reviewed schedule"}
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
