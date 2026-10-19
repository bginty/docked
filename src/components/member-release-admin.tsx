"use client";
import { useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import {
  prizeItems,
  type PrizeAdminView,
  type PrizeItem,
} from "@/core/prize-schedules";
const blank = (): PrizeItem => ({
  from: 1,
  to: 1,
  description: "",
  type: "credits",
  amount: 1,
});
export function MemberReleaseAdmin({ initial }: { initial: PrizeAdminView }) {
  const [view, setView] = useState(initial),
    [competition, setCompetition] = useState(initial.competitions[0]?.id ?? ""),
    [scope, setScope] = useState<"weekly" | "season">("weekly"),
    [items, setItems] = useState<PrizeItem[]>([blank()]),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [publish, setPublish] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const [member, setMember] = useState(initial.names[0]?.user ?? ""),
    [name, setName] = useState(""),
    [nameReason, setNameReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const c = view.competitions.find((c) => c.id === competition);
  const current = view.schedules.find(
    (s) =>
      s.sport === c?.sport &&
      s.mode === c.mode &&
      s.season === c.season &&
      s.scope === scope &&
      s.week === (scope === "weekly" ? c.week : 0),
  );
  async function submit(command: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await boundedFetch("/api/admin/member-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setView(data);
      setReviewed(false);
      setConfirmed(false);
      setMessage("Saved and audited.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save unavailable");
    } finally {
      setBusy(false);
    }
  }
  const edit = (index: number, patch: Partial<PrizeItem>) => {
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    setReviewed(false);
  };
  return (
    <div className="release-admin">
      <h1>Prizes & team names</h1>
      <p>
        Configure rewards only. Publishing a schedule does not issue prizes.
      </p>
      {message && <p role="status">{message}</p>}
      <section>
        <h2>Prize schedule</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const validated = prizeItems.safeParse(items);
            if (!validated.success) {
              setMessage(
                "Check reward amounts and non-overlapping finishing ranges.",
              );
              return;
            }
            void submit({
              action: "prizes",
              competition,
              scope,
              items: validated.data,
              publish,
              revision: current?.revision ?? 0,
              reason,
            });
          }}
        >
          <label>
            Competition
            <select
              value={competition}
              onChange={(e) => {
                setCompetition(e.target.value);
                setReviewed(false);
              }}
            >
              {view.competitions.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.sport.toUpperCase()} · {c.name} · {c.season} · Week{" "}
                  {c.week}
                </option>
              ))}
            </select>
          </label>
          <label>
            Period
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as typeof scope);
                setReviewed(false);
              }}
            >
              <option value="weekly">Weekly</option>
              <option value="season">Season</option>
            </select>
          </label>
          <p>
            {current
              ? `Revision ${current.revision} · ${current.published ? "Published version available" : "Draft only"}`
              : "No schedule configured"}
          </p>
          {current && (
            <button
              type="button"
              onClick={() => {
                setItems(current.draft);
                setReviewed(false);
              }}
            >
              Load saved draft
            </button>
          )}
          {items.map((item, i) => (
            <fieldset key={i}>
              <legend>Reward {i + 1}</legend>
              <div className="prize-range">
                <label>
                  From
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={item.from}
                    onChange={(e) => edit(i, { from: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Through
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={item.to}
                    onChange={(e) => edit(i, { to: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Reward
                  <input
                    required
                    maxLength={240}
                    value={item.description}
                    onChange={(e) => edit(i, { description: e.target.value })}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={item.type}
                    onChange={(e) =>
                      edit(i, { type: e.target.value as PrizeItem["type"] })
                    }
                  >
                    {["credits", "card", "pack", "other"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    required
                    type="number"
                    min="1"
                    max="1000000000"
                    value={item.amount}
                    onChange={(e) =>
                      edit(i, { amount: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={items.length === 1}
                onClick={() => {
                  setItems(items.filter((_, j) => j !== i));
                  setReviewed(false);
                }}
              >
                Remove range
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={items.length >= 100}
            onClick={() => {
              setItems([
                ...items,
                {
                  ...blank(),
                  from: Math.max(...items.map((i) => i.to)) + 1,
                  to: Math.max(...items.map((i) => i.to)) + 1,
                },
              ]);
              setReviewed(false);
            }}
          >
            Add reward range
          </button>
          <label>
            Reason
            <input
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            <span>
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => {
                  setPublish(e.target.checked);
                  setReviewed(false);
                }}
              />{" "}
              Publish for members
            </span>
          </label>
          {publish && (
            <>
              <h3>Publication review</h3>
              <ul>
                {items.map((i, n) => (
                  <li key={n}>
                    {i.from}–{i.to}: {i.description} ({i.amount} {i.type})
                  </li>
                ))}
              </ul>
              <label>
                <span>
                  <input
                    type="checkbox"
                    required
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />{" "}
                  I confirm these configured rewards and this competition
                  period.
                </span>
              </label>
            </>
          )}
          <button disabled={busy || !competition || (publish && !reviewed)}>
            {busy ? "Saving…" : publish ? "Publish schedule" : "Save draft"}
          </button>
        </form>
      </section>
      <section>
        <h2>Change an established team name</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit({
              action: "name",
              user: member,
              name,
              previous: view.names.find((n) => n.user === member)?.name,
              reason: nameReason,
              confirmed,
            });
          }}
        >
          <label>
            Current team
            <select
              value={member}
              onChange={(e) => {
                setMember(e.target.value);
                setConfirmed(false);
              }}
            >
              {view.names.map((n) => (
                <option key={n.user} value={n.user}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New team name
            <input
              required
              minLength={2}
              maxLength={40}
              pattern="[A-Za-z0-9][A-Za-z0-9 .'-]*"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Reason
            <input
              required
              maxLength={500}
              value={nameReason}
              onChange={(e) => setNameReason(e.target.value)}
            />
          </label>
          <label>
            <span>
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              Confirm changing {view.names.find((n) => n.user === member)?.name}{" "}
              to {name || "the new name"}.
            </span>
          </label>
          <button disabled={busy || !confirmed || !member}>
            Save audited name change
          </button>
        </form>
      </section>
      <section>
        <h2>Audit history</h2>
        {view.audit.map((a, i) => (
          <details key={i}>
            <summary>
              {new Date(a.created_at).toLocaleString("en-AU")} · {a.action}
            </summary>
            <p>Administrator: {a.actor}</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(a.details, null, 2)}
            </pre>
          </details>
        ))}
      </section>
    </div>
  );
}
