/** Read-only source reconstruction. Publishes player/source facts only, no member data. */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir(process.env.DOCKED_PRIVATE_ROOT ?? root);
const db = ownerDatabase();
process.chdir(root);
const historical = JSON.parse(
  readFileSync(
    "docs/qa/nfl-roster-reconciliation/eligible-catalogue.json",
    "utf8",
  ),
);
const reviewed = new Map<string, any>(historical.map((p: any) => [p.id, p]));
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
async function main() {
  const evidence = await db
    .begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local statement_timeout='60s'`;
      const nfl =
        await tx`select np.player_id::text id,np.provider_id,pl.name,pl.position,pl.colour,pl.shirt,
      np.edition_id::text,np.edition_team,np.observed_at, np.source_status,e.season,
      pp.identity registered_identity,
      (select to_jsonb(o) from nfl_roster.observations o where o.player_id=np.player_id::text and o.provider_id=np.provider_id
       and (pl.position=any(string_to_array(o.position,'/')) or (pl.position='RB' and string_to_array(o.position,'/') && array['FB','HB'])) and o.identity_verified and o.checked_at<'2026-11-10' order by o.checked_at,o.source_hash limit 1) verified,
      exists(select 1 from nfl_roster.observations o where o.player_id=np.player_id::text and o.provider_id=np.provider_id
       and (pl.position=any(string_to_array(o.position,'/')) or (pl.position='RB' and string_to_array(o.position,'/') && array['FB','HB'])) and o.identity_verified and o.status='active' and o.checked_at<'2026-11-10') historically_active
      from sports_feed.nfl_players np join beta_fantasy.players pl on pl.id=np.player_id
      join beta_fantasy.editions e on e.id=np.edition_id left join credits_sandbox.permanent_players pp on pp.id=np.player_id::text
      where e.tier='CORE' and e.status='launched' and e.season='2026' order by np.player_id`;
      const australian =
        await tx`select id,identity from credits_sandbox.nba_fixture_players where identity->>'sport' in('afl','nrl') and credits_sandbox.is_roster_beta_player(identity) order by id`;
      const inventory =
        await tx`select sport,count(*)::int definitions,count(distinct player_id)::int players,sum(issued)::int issued,count(*) filter(where approved)::int approved from commercial_billing.definitions group by sport order by sport`;
      return { nfl, australian, inventory };
    })
    .finally(() => db.end());
  const members: any[] = [],
    review: any[] = [];
  for (const p of evidence.nfl) {
    const old = reviewed.get(p.id);
    const identityMatches =
      p.registered_identity?.providerId === p.provider_id &&
      p.registered_identity?.position === p.position;
    const priorApproval =
      p.historically_active ||
      (old?.providerId === p.provider_id && old?.position === p.position);
    const entry = {
      sport: "nfl",
      season: "2026",
      player_id: p.id,
      provider: "nflverse",
      provider_id: p.provider_id,
      snapshot: {
        ...p.registered_identity,
        name: p.name,
        position: p.position,
        colour: p.colour,
        shirt: p.shirt,
        currentTeam: p.edition_team,
      },
      edition_id: p.edition_id,
      evidence: {
        registeredIdentity: p.registered_identity,
        official: p.verified,
        historicalCatalogue: old ?? null,
      },
      approval_reference:
        "retained verified identity plus launched 2026 Core edition and prior acquisition approval",
    };
    if (
      identityMatches &&
      priorApproval &&
      p.verified &&
      /^[a-f0-9]{64}$/.test(p.verified.source_hash)
    )
      members.push(entry);
    else
      review.push({
        ...entry,
        reason: !identityMatches
          ? "canonical identity mismatch"
          : !p.verified
            ? "no matching verified retained source"
            : "no demonstrated prior acquisition approval",
      });
  }
  for (const p of evidence.australian)
    members.push({
      sport: p.identity.sport,
      season: "2026",
      player_id: p.identity.fixturePlayerId,
      provider: p.identity.provider,
      provider_id: p.identity.providerId,
      snapshot: p.identity,
      edition_id: null,
      evidence: { registryId: p.id, rosterBeta: p.identity.rosterBeta },
      approval_reference:
        "existing verified roster-beta registry; immutable roster/profile agreement",
    });
  const manifest = {
    version: "season-catalogue-2026-v1",
    capturedAt: new Date().toISOString(),
    scope: "free_weekly only; proposed, not adopted",
    historicalCatalogueSha256: sha(
      readFileSync(
        "docs/qa/nfl-roster-reconciliation/eligible-catalogue.json",
        "utf8",
      ),
    ),
    members,
    review,
    inventory: evidence.inventory,
  };
  const dir = "docs/qa/season-catalogue-20261115";
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    dir + "/catalogue-proposal.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      proposed: members.reduce(
        (n, p) => ((n[p.sport] = (n[p.sport] ?? 0) + 1), n),
        {},
      ),
      review: review.map((p) => ({
        id: p.player_id,
        name: p.snapshot.name,
        reason: p.reason,
      })),
      inventory: manifest.inventory,
    }),
  );
}
main().catch(() => {
  console.error("Read-only catalogue evidence failed; no hosted changes.");
  process.exitCode = 1;
});
