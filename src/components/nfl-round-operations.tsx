import { db } from "@/server/db";
import { requireRole } from "@/server/auth";
import type { ReviewContext } from "@/core/competition-review";

/** Existing permission-scoped read RPCs only; never run reconciliation from a GET. */
export async function NflRoundOperations() {
  const who = await requireRole(["owner"]);
  try {
    const data = await db().begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
      const [context] =
        await tx`select sports_feed.member_review_context() context`;
      const [standings] =
        await tx`select sports_feed.nfl_standings() standings`;
      return {
        context: context.context as ReviewContext,
        standings: standings.standings as {
          competitionId: string;
          rows: { status: string }[];
        }[],
      };
    });
    return (
      <section className="fantasy-panel">
        <h2>Competition scoring</h2>
        <p>
          Frozen rules and published journal results. History imports do not
          settle these competitions. No manual score or reward controls are
          available here.
        </p>
        {data.context.rounds.map((r) => {
          const rows =
            data.standings.find((s) => s.competitionId === r.id)?.rows ?? [];
          const pending = rows.filter(
            (x) => x.status === "pending-data",
          ).length;
          const provisional = rows.filter(
            (x) => x.status === "provisional",
          ).length;
          const final = rows.filter((x) => x.status === "final").length;
          return (
            <details key={r.id}>
              <summary>
                {r.name} ·{" "}
                {r.finalAt
                  ? "Finalised results"
                  : pending
                    ? "Awaiting statistics / scoring"
                    : provisional
                      ? "Provisional results"
                      : "Awaiting entries / results"}
              </summary>
              <p>
                {r.entryCount} entries · {pending} pending · {provisional}{" "}
                provisional · {final} finalised.
              </p>
              <p>
                Rules: {r.rules.version}. Receptions:{" "}
                {(r.rules.weights.receptions ?? 0) / 100} each.{" "}
                {r.rules.rarityVersion
                  ? `Explicit frozen rarity policy: ${r.rules.rarityVersion}.`
                  : "No rarity scoring multiplier."}
              </p>
              <p>
                Last journal update: {r.updatedAt ?? "Unavailable"}. Finalised:{" "}
                {r.finalAt ?? "No"}.{" "}
                {r.visible ? "Standings published." : "Standings under review."}
              </p>
              <a href="/fantasy/standings">View standings</a>
            </details>
          );
        })}
      </section>
    );
  } catch {
    return (
      <section className="fantasy-panel">
        <h2>Competition scoring</h2>
        <p role="status">
          Competition diagnostics unavailable. Do not infer zero scores or
          completed runs.
        </p>
      </section>
    );
  }
}
