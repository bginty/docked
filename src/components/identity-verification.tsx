"use client";
import { useEffect, useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import {
  syntheticIdentityPolicy,
  type IdentityCase,
  type IdentityCaseCommand,
  type identityCaseView,
} from "@/core/manual-identity";
import { NavigationShortcut } from "./navigation-shortcut";
type View = ReturnType<typeof identityCaseView>;
const labels = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  MORE_INFORMATION: "Changes requested",
  REJECTED: "Rejected",
  VERIFIED: "Verified",
  REVOKED: "Reverification required",
};
export function IdentityVerification({ admin = false }: { admin?: boolean }) {
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    [step, setStep] = useState(1),
    [types, setTypes] = useState<string[]>(["", ""]),
    [confirmed, setConfirmed] = useState(false),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState("");
  const pending = useRef<{ request: string; case: IdentityCaseCommand } | null>(
    null,
  );
  const api = `/api/identity-verification${admin ? "?admin=true" : ""}`;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void boundedFetch(api, { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("Verification could not load. Please retry.");
        const d = (await r.json()) as View;
        if (!controller.signal.aborted) {
          setView(d);
          if (!admin && d.cases[0])
            setTypes([
              d.cases[0].documents[0]?.type ?? "",
              d.cases[0].documents[1]?.type ?? "",
            ]);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [api, attempt, admin]);
  async function send(command: IdentityCaseCommand) {
    if (busy) return false;
    const body = pending.current ?? {
      request: crypto.randomUUID(),
      case: command,
    };
    pending.current = body;
    setBusy(true);
    setError("");
    try {
      const r = await boundedFetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok)
        throw Error("Update not confirmed. Refresh the case before retrying.");
      setView(await r.json());
      pending.current = null;
      setConfirmed(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const item = view?.cases[0];
  const editable =
    !item ||
    ["DRAFT", "MORE_INFORMATION", "REJECTED", "REVOKED"].includes(item.status);
  return (
    <section className="identity-page" data-private="true">
      <h1>
        {admin ? "Identity verification reviews" : "Verify your identity"}
      </h1>
      {!admin && (
        <p>
          Required before your first withdrawal. You can deposit before
          verification.
        </p>
      )}
      <NavigationShortcut
        compact
        href={admin ? "/admin/operations" : "/fantasy/profile"}
      >
        {admin ? "Owner dashboard" : "Back to Profile"}
      </NavigationShortcut>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button"
            onClick={() => {
              pending.current = null;
              setAttempt((n) => n + 1);
            }}
          >
            Refresh case
          </button>
        </div>
      )}
      {!view && !error && <p role="status">Loading verification…</p>}
      {view && !view.enabled && (
        <section className="identity-notice">
          <h2>Not started</h2>
          <p>
            Identity document collection is not enabled in this test
            environment. Do not upload real ID documents.
          </p>
          <p>
            Test credits cannot be withdrawn. Accepted ID types, the privacy
            collection notice, retention policy and secure review services must
            be configured before real documents can be accepted.
          </p>
        </section>
      )}
      {view?.enabled && (
        <>
          <p className="identity-notice">
            Synthetic document testing only · No real identity documents or
            payments.
          </p>
          {admin ? (
            <>
              <div className="identity-filters">
                <label>
                  Case search
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Case reference"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {Object.entries(labels).map(([s, l]) => (
                      <option key={s} value={s}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {view.cases
                .filter(
                  (c) =>
                    (!filter || c.status === filter) &&
                    c.id.toLowerCase().includes(search.toLowerCase()),
                )
                .map((c) => (
                  <IdentityReview key={c.id} item={c} busy={busy} send={send} />
                ))}
              {!view.cases.length && <p>No cases awaiting review.</p>}
              <h2>Support notifications</h2>
              {view.outbox.map((n) => (
                <p key={n.id}>
                  {n.reference} · {n.status} · {n.attempts} delivery attempts
                  {n.deliveryError ? ` · ${n.deliveryError}` : ""}
                </p>
              ))}
            </>
          ) : (
            <>
              {item && (
                <section className="identity-status">
                  <h2>{labels[item.status]}</h2>
                  <p>Case reference: {item.id}</p>
                  {item.submittedAt && (
                    <p>
                      Submitted {new Date(item.submittedAt).toLocaleString()}
                    </p>
                  )}
                  {item.reason && <p>{item.reason}</p>}
                  {item.replaceDocument && (
                    <p>
                      Replace:{" "}
                      {
                        syntheticIdentityPolicy.types.find(
                          (t) => t.id === item.replaceDocument,
                        )?.label
                      }
                    </p>
                  )}
                  <p>
                    {item.status === "VERIFIED"
                      ? "Identity verification complete. Other withdrawal restrictions still apply; test credits remain non-redeemable."
                      : "Withdrawals remain unavailable until identity verification and other eligibility conditions are satisfied."}
                  </p>
                </section>
              )}
              {editable && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (step < 3) setStep(step + 1);
                    else
                      void send({
                        action: "submit",
                        revision: item?.revision ?? 0,
                        confirmed: true,
                      });
                  }}
                >
                  <ol className="identity-steps">
                    {["Your details", "Documents", "Review and submit"].map(
                      (s, i) => (
                        <li
                          key={s}
                          aria-current={step === i + 1 ? "step" : undefined}
                        >
                          {i + 1} · {s}
                        </li>
                      ),
                    )}
                  </ol>
                  {step === 1 && (
                    <fieldset>
                      <legend>Your details</legend>
                      <label>
                        Legal name
                        <input value="Synthetic Applicant" readOnly />
                      </label>
                      <label>
                        Date of birth
                        <input type="date" value="1990-01-01" readOnly />
                      </label>
                      <p>
                        Fixed fictional details keep this test separate from
                        real identity collection.
                      </p>
                    </fieldset>
                  )}
                  {step === 2 && (
                    <>
                      <h2>Two distinct forms of ID</h2>
                      <p>
                        Proposed test policy: at least one photo ID. Front and
                        back of one licence count as one ID.
                      </p>
                      {[0, 1].map((i) => (
                        <fieldset key={i}>
                          <legend>Document {i + 1}</legend>
                          <label>
                            Document type {i + 1}
                            <select
                              aria-label={`Document type ${i + 1}`}
                              value={types[i]}
                              onChange={(e) =>
                                setTypes((a) =>
                                  a.map((t, j) =>
                                    i === j ? e.target.value : t,
                                  ),
                                )
                              }
                            >
                              <option value="">Choose type</option>
                              {syntheticIdentityPolicy.types.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {syntheticIdentityPolicy.types
                            .find((t) => t.id === types[i])
                            ?.sides.map((side) => (
                              <div className="synthetic-document" key={side}>
                                <strong>SYNTHETIC · {side}</strong>
                                <span>
                                  Generated test evidence · No real document
                                </span>
                              </div>
                            ))}
                          <button
                            type="button"
                            className="button"
                            onClick={() =>
                              setTypes((a) =>
                                a.map((t, j) => (i === j ? "" : t)),
                              )
                            }
                          >
                            Remove document {i + 1}
                          </button>
                        </fieldset>
                      ))}
                      <p>
                        Production file policy proposal: JPG, PNG or PDF, up to
                        10 MB per file. HEIC is not supported.
                      </p>
                      <button
                        type="button"
                        className="button primary"
                        disabled={
                          busy ||
                          !types[0] ||
                          !types[1] ||
                          types[0] === types[1]
                        }
                        onClick={async () => {
                          await send({
                            action: "save",
                            revision: item?.revision ?? 0,
                            legalName: "Synthetic Applicant",
                            dob: "1990-01-01",
                            documents: types as (
                              "licence" | "passport" | "secondary"
                            )[],
                          });
                        }}
                      >
                        Save synthetic documents
                      </button>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <h2>Review your submission</h2>
                      <p>Synthetic Applicant · 1 January 1990</p>
                      {item?.documents.map((d) => (
                        <p key={d.type}>
                          {
                            syntheticIdentityPolicy.types.find(
                              (t) => t.id === d.type,
                            )?.label
                          }{" "}
                          · {d.files.length} required side(s)
                        </p>
                      ))}
                      <p>
                        <a href="/privacy">Privacy notice</a> · Production
                        identity collection notice is pending approval.
                      </p>
                      <label className="identity-confirm">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                        />
                        I confirm these test documents represent the applicant
                        and I have read the privacy notice.
                      </label>
                    </>
                  )}
                  <div className="identity-actions">
                    {step > 1 && (
                      <button
                        type="button"
                        className="button"
                        onClick={() => setStep(step - 1)}
                      >
                        Back
                      </button>
                    )}
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        (step === 2 &&
                          (!item ||
                            item.documents.length !== 2 ||
                            types.join() !==
                              item.documents.map((d) => d.type).join())) ||
                        (step === 3 && !confirmed)
                      }
                    >
                      {busy
                        ? "Saving…"
                        : step === 3
                          ? "Submit for review"
                          : "Continue"}
                    </button>
                  </div>
                </form>
              )}
              <a href="mailto:support@docked.com.au">Contact support</a>
            </>
          )}
        </>
      )}
    </section>
  );
}
function IdentityReview({
  item,
  busy,
  send,
}: {
  item: IdentityCase;
  busy: boolean;
  send: (c: IdentityCaseCommand) => Promise<boolean>;
}) {
  const [reason, setReason] = useState(""),
    [note, setNote] = useState(""),
    [document, setDocument] = useState("licence"),
    [check, setCheck] = useState({ name: false, dob: false, readable: false }),
    [viewing, setViewing] = useState(false);
  return (
    <article className="identity-review">
      <h2>
        {item.id} · {labels[item.status]}
      </h2>
      <p>
        {item.legalName} · {item.dob}
      </p>
      <p>
        Submitted document version {item.documentVersion} · {item.policy}
      </p>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          const file = item.snapshots.at(-1)?.documents[0]?.files[0];
          if (file) {
            const accepted = await send({
              action: "access",
              member: item.member,
              revision: item.revision,
              documentVersion: item.documentVersion,
              file: file.id,
            });
            if (accepted) setViewing(true);
          }
        }}
      >
        View synthetic documents securely
      </button>
      {viewing && (
        <p className="synthetic-document">
          SYNTHETIC EVIDENCE ONLY · No personal document content.
        </p>
      )}
      <fieldset>
        <legend>Review checklist</legend>
        {Object.keys(check).map((k) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={check[k as keyof typeof check]}
              onChange={(e) =>
                setCheck((v) => ({ ...v, [k]: e.target.checked }))
              }
            />
            {k === "name"
              ? "Name matches documents"
              : k === "dob"
                ? "Date of birth matches documents"
                : "Documents are readable and valid"}
          </label>
        ))}
      </fieldset>
      <label>
        Customer-facing reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={240}
        />
      </label>
      <label>
        Internal notes
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
        />
      </label>
      <label>
        Document requiring replacement
        <select value={document} onChange={(e) => setDocument(e.target.value)}>
          {syntheticIdentityPolicy.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <div className="identity-actions">
        {(["MORE_INFORMATION", "REJECTED", "VERIFIED", "REVOKED"] as const).map(
          (decision) => (
            <button
              className={`button ${decision === "VERIFIED" ? "primary" : ""}`}
              key={decision}
              disabled={
                busy ||
                reason.trim().length < 3 ||
                (decision === "REVOKED"
                  ? item.status !== "VERIFIED"
                  : item.status !== "UNDER_REVIEW") ||
                (decision === "VERIFIED" &&
                  !Object.values(check).every(Boolean))
              }
              onClick={() =>
                void send({
                  action: "review",
                  member: item.member,
                  revision: item.revision,
                  documentVersion: item.documentVersion,
                  decision,
                  reason,
                  internalNote: note,
                  document: document as "licence",
                  checklist: check,
                })
              }
            >
              {decision === "VERIFIED"
                ? "Approve verification"
                : decision === "MORE_INFORMATION"
                  ? "Request changes"
                  : decision === "REVOKED"
                    ? "Revoke approval"
                    : "Reject"}
            </button>
          ),
        )}
      </div>
      <details>
        <summary>Audit trail</summary>
        {item.audit.map((a, i) => (
          <p key={i}>
            {new Date(a.at).toLocaleString()} · {a.action} · version {a.version}
            {a.reason ? ` · ${a.reason}` : ""}
            {a.internalNote ? ` · Internal: ${a.internalNote}` : ""}
          </p>
        ))}
      </details>
    </article>
  );
}
