import "server-only";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { setCommunityClaims } from "./community-social";
import { testCard } from "@/core/member-test-wallet";
import { type CreditsState } from "@/core/credits-sandbox";
import { collectionCsv, type ExportCard } from "@/core/collection-export";
import production from "../../config/hosted-production.json";
export async function exportCollection() {
  const who = await requireIdentity();
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Collection export unavailable");
  if (!(await rateLimit(`collection-export:${who.user.id}`, 5, 60)))
    throw Error("Please wait before exporting again");
  return db().begin(async (tx) => {
    // One ownership snapshot across both existing inventories and active listings.
    await tx`select pg_advisory_xact_lock(71820342)`;
    await setCommunityClaims(tx, who);
    await tx`select set_config('docked.fantasy_production',${production.supabaseProjectRef!},true),set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true)`;
    const [legacy] = await tx`select fantasy.collection_export_legacy() cards`;
    const cards = new Map<string, ExportCard>(
      (legacy.cards as ExportCard[]).map((c) => [c.id, c]),
    );
    const [row] = await tx`select document from credits_sandbox.state where id`;
    if (row) {
      const s = row.document as CreditsState;
      for (const [id, owned] of Object.entries(s.commerce.cards)) {
        if (owned.owner !== who.user.id || !s.cards[id]) continue;
        const pack = s.economy?.instances[id]?.source;
        if (pack && s.entitlements[pack]?.status !== "OPENED") continue;
        const c = testCard(s, id);
        const at = s.cards[id].history
          .filter((h) => h.to === who.user.id)
          .at(-1)?.at;
        const listing = Object.values(s.listings).find(
          (l) =>
            l.card === id && l.member === who.user.id && l.status === "OPEN",
        );
        cards.set(id, {
          ...c,
          acquired_at: at === undefined ? null : new Date(at).toISOString(),
          listing_price: listing?.price ?? null,
        });
      }
    }
    return collectionCsv(
      [...cards.values()].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
}
