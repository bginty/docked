"use client";
import { useState, type FormEvent } from "react";
import { competitionDraftSchema, dealDraftSchema } from "@/core/membership";
import { communityAction } from "./social-interactions";

/** Staff-only drafting. There is deliberately no activation or awarding control. */
export function DisabledBenefitsDraft({
  kind,
}: {
  kind: "competition" | "deal";
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const list = (key: string) =>
      value(key)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    const instant = (key: string) => new Date(`${value(key)}Z`).toISOString();
    setBusy(true);
    setMessage("");
    try {
      const base = {
        title: value("title"),
        description: value("description"),
        country: value("country").toUpperCase(),
        state: value("state"),
        membership: value("membership"),
        startsAt: instant("startsAt"),
        endsAt: instant("endsAt"),
        sponsor: value("sponsor"),
        reason: value("reason"),
      };
      const parsed =
        kind === "competition"
          ? competitionDraftSchema.safeParse({
              ...base,
              minimumAge: Number(value("minimumAge")),
              entryCutoff: instant("entryCutoff"),
              sports: list("sports"),
              markets: list("markets"),
              rankingRuleVersion: value("rankingRuleVersion"),
              minimumSettled: Number(value("minimumSettled")),
              minimumActiveDays: Number(value("minimumActiveDays")),
              prize: value("prize"),
              prizeValue: value("prizeValue") || null,
              currency: value("currency").toUpperCase() || null,
              officialRulesVersion: value("officialRulesVersion"),
              entryLimit: 1,
              tieBreaker: "NET_UNITS_ROI_SETTLED_EARLIEST",
              exclusions: list("exclusions"),
              mechanics: value("mechanics"),
            })
          : dealDraftSchema.safeParse({
              ...base,
              category: value("category"),
              terms: value("terms"),
              disclosure: value("disclosure"),
              trackingClass: value("trackingClass"),
            });
      if (!parsed.success) {
        setMessage(
          parsed.error.issues
            .map((issue) => `${issue.path.join(" ")}: ${issue.message}`)
            .join(" "),
        );
        return;
      }
      const result = await communityAction(
        {
          action: kind === "competition" ? "competition_draft" : "deal_draft",
          input: parsed.data,
        },
        "/api/admin/benefits",
      );
      setMessage(
        `Disabled draft saved (${result.id}). No public offer, entry or award is active.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The draft was not confirmed saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="app-panel">
      <h2>Create a disabled {kind} draft</h2>
      <p>
        Save the reviewed details for later approval. Unknown facts must be
        resolved before saving. Every date below is UTC.
      </p>
      <form className="app-form" method="post" onSubmit={save}>
        <fieldset>
          <legend>Draft and eligibility</legend>
          <label>
            Title
            <input name="title" required minLength={5} maxLength={160} />
          </label>
          <label>
            Description
            <textarea
              name="description"
              required
              minLength={30}
              maxLength={4000}
            />
          </label>
          <label>
            Country code
            <input
              name="country"
              required
              pattern="[A-Za-z]{2}"
              minLength={2}
              maxLength={2}
              autoCapitalize="characters"
              placeholder="Two-letter country code"
            />
          </label>
          <label>
            State or region
            <input name="state" required maxLength={50} />
          </label>
          <label>
            Membership eligibility
            <select name="membership" defaultValue="FREE">
              <option value="FREE">Free</option>
              <option value="FREE_AND_PRO">Free and future Pro</option>
              <option value="FUTURE_PRO">
                Future Pro — requires separate legal review
              </option>
            </select>
          </label>
          <label>
            Starts at (UTC)
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label>
            Ends at (UTC)
            <input name="endsAt" type="datetime-local" required />
          </label>
          <label>
            Sponsor or responsible organisation
            <input name="sponsor" required minLength={2} maxLength={160} />
          </label>
        </fieldset>
        {kind === "competition" ? (
          <>
            <fieldset>
              <legend>Frozen competition rules</legend>
              <label>
                Entry cutoff (UTC)
                <input name="entryCutoff" type="datetime-local" required />
              </label>
              <label>
                Minimum age
                <input
                  name="minimumAge"
                  type="number"
                  min={18}
                  max={100}
                  defaultValue={18}
                  required
                />
              </label>
              <label>
                Sports (comma separated)
                <input
                  name="sports"
                  required
                  placeholder="Reviewed sport identifiers"
                />
              </label>
              <label>
                Markets (comma separated)
                <input
                  name="markets"
                  required
                  placeholder="Reviewed market identifiers"
                />
              </label>
              <label>
                Ranking rule version
                <input
                  name="rankingRuleVersion"
                  required
                  minLength={3}
                  maxLength={100}
                />
              </label>
              <label>
                Official rules version
                <input
                  name="officialRulesVersion"
                  required
                  minLength={3}
                  maxLength={100}
                />
              </label>
              <label>
                Minimum settled verified Edges
                <input
                  name="minimumSettled"
                  type="number"
                  min={20}
                  defaultValue={20}
                  required
                />
              </label>
              <label>
                Minimum active UTC days
                <input
                  name="minimumActiveDays"
                  type="number"
                  min={7}
                  defaultValue={7}
                  required
                />
              </label>
              <label>
                Mechanics
                <select name="mechanics">
                  <option value="STANDARD_VERIFIED_PERFORMANCE">
                    Standard verified performance
                  </option>
                  <option value="NON_WAGER_PREDICTION">
                    Non-wager prediction challenge
                  </option>
                </select>
              </label>
              <label>
                Exclusions (comma separated)
                <textarea
                  name="exclusions"
                  required
                  placeholder="Reviewed exclusions from the official rules"
                />
              </label>
              <p className="form-help">
                One entry per member. Proposed tie order: net units, ROI,
                settled count, earliest qualifying record. No cash stake,
                deposits, followers or gambling volume enter this rule.
              </p>
            </fieldset>
            <fieldset>
              <legend>Proposed prize — no award is active</legend>
              <label>
                Prize description
                <textarea
                  name="prize"
                  required
                  minLength={3}
                  maxLength={1000}
                />
              </label>
              <label>
                Declared value (leave blank if unknown)
                <input
                  name="prizeValue"
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                />
              </label>
              <label>
                Currency code (required with a declared value)
                <input
                  name="currency"
                  pattern="[A-Za-z]{3}"
                  minLength={3}
                  maxLength={3}
                  autoCapitalize="characters"
                />
              </label>
            </fieldset>
          </>
        ) : (
          <fieldset>
            <legend>Terms and disclosure</legend>
            <label>
              Category
              <select name="category">
                <option value="MERCHANDISE">Sports merchandise</option>
                <option value="MEDIA">Sports media</option>
                <option value="TICKETS">Tickets</option>
                <option value="DOCKED_BENEFIT">Docked benefit</option>
                <option value="NON_GAMBLING">Other non-gambling sponsor</option>
                <option value="BETTING_REVIEW_REQUIRED">
                  Betting-related — separate review required
                </option>
              </select>
            </label>
            <label>
              Terms
              <textarea name="terms" required minLength={12} maxLength={2000} />
            </label>
            <label>
              Sponsorship disclosure
              <textarea
                name="disclosure"
                required
                minLength={12}
                maxLength={2000}
              />
            </label>
            <label>
              Future tracking class
              <select name="trackingClass">
                <option value="NONE">None</option>
                <option value="CONSENTED_AGGREGATE">
                  Consented aggregate, subject to review
                </option>
              </select>
            </label>
          </fieldset>
        )}
        <label>
          Audit reason
          <textarea name="reason" required minLength={12} maxLength={2000} />
        </label>
        <p className="form-help">
          Saving freezes this draft. Changes require a new draft/version. Legal
          and commercial approval remain separate; this form cannot enable
          billing, entry, prizes, affiliates or offers.
        </p>
        <button className="button" disabled={busy}>
          {busy ? "Saving disabled draft…" : "Save disabled draft"}
        </button>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
