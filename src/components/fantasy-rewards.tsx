"use client";
import type { FantasyState } from "@/core/fantasy";
export function FantasyRewards({
  rewards,
  busy,
  act,
  refresh,
  onOpenStarter,
  onReplayStarter,
}: {
  rewards: NonNullable<FantasyState["rewards"]>;
  busy: boolean;
  act: (action: string, payload?: Record<string, unknown>) => unknown;
  refresh: () => unknown;
  onOpenStarter?: () => void;
  onReplayStarter?: () => void;
}) {
  if (rewards.daily_available === false)
    return (
      <section className="fantasy-panel">
        <h2>Your free NFL starter pack</h2>
        <p>
          Ten free CORE cards: 2 QB, 3 RB, 3 WR and 2 TE. Start seven, including
          one FLEX. Free test cards have no cash value. Core scores at 1.0×.
          Salary Cap and Open apply rarity multipliers; legacy equal-scoring
          competitions retain their saved rules.
        </p>
        {!rewards.starter_claimed ? (
          <button
            disabled={busy}
            onClick={() =>
              onOpenStarter ? onOpenStarter() : act("open_nfl_starter")
            }
          >
            {busy ? "Opening your pack…" : "Open my free pack"}
          </button>
        ) : (
          <p>
            Your pack is open. Choose seven players from My Cards to build your
            first team. You can change your team for free before the deadline.
          </p>
        )}
        {rewards.starter_claimed && onReplayStarter && (
          <button type="button" onClick={onReplayStarter}>
            View saved pack result
          </button>
        )}
      </section>
    );
  const date = (s: string) =>
    new Date(s).toLocaleString("en-AU", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " UTC";
  return (
    <section className="fantasy-panel">
      <p className="eyebrow">YOUR DAILY CLUB REWARD</p>
      <h2>Free to collect. Free to compete.</h2>
      {rewards.release_channel === "beta" && (
        <p>
          Beta gameplay points. These are kept separate from official launch
          rankings.
        </p>
      )}
      {!rewards.starter_claimed && (
        <>
          <p>
            Your free Starter pack contains eleven CORE cards: 1 goalkeeper, 4
            defenders, 4 midfielders and 2 forwards. One pack per verified
            account, while the declared inventory remains available.
          </p>
          <button disabled={busy} onClick={() => act("claim_starter")}>
            Claim free Starter pack
          </button>
        </>
      )}
      <p>
        Earn {rewards.policy.daily_points} non-transferable gameplay points each
        day. Points have no cash value, cannot be spent or transferred, and
        never multiply fantasy scores.
      </p>
      <p>
        Every {rewards.policy.card_every} claimed days may also award one CORE
        card, subject to the permanent edition limits and a shared daily limit
        of {rewards.policy.daily_card_limit} cards. If card inventory is
        unavailable, the points reward remains.
      </p>
      <div className="actions">
        <button
          disabled={busy || !rewards.starter_claimed || rewards.claimed_today}
          onClick={() => act("claim_daily")}
        >
          {rewards.claimed_today
            ? "Today's reward claimed"
            : "Claim daily reward"}
        </button>
        <button disabled={busy} onClick={refresh}>
          Refresh reward status
        </button>
      </div>
      <p>
        {rewards.claimed_today
          ? "Next claim: "
          : "Available now · server time: "}
        <time dateTime={rewards.next_claim_at}>
          {date(rewards.next_claim_at)}
        </time>
        . Daily periods reset at 00:00 UTC.
      </p>
      <h3>{Number(rewards.points).toLocaleString()} gameplay points</h3>
      <details>
        <summary>Reward history · latest 90 claims</summary>
        {rewards.history.length ? (
          rewards.history.map((h) => (
            <div className="fantasy-row" key={h.period}>
              <span>
                {h.period}
                {h.release_channel && ` · ${h.release_channel}`}
                <small>
                  Policy {h.policy_version} ·{" "}
                  {h.card_outcome.replaceAll("_", " ")}
                </small>
              </span>
              <strong>
                +{h.points} points{h.pack_id ? " + card pack" : ""}
              </strong>
            </div>
          ))
        ) : (
          <p>No daily rewards claimed yet.</p>
        )}
      </details>
    </section>
  );
}
