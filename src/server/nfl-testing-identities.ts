/** Operator-reviewed bridge. Provider IDs are confined to review evidence, never
 * inferred from feed canonical IDs or names. Existing Docked IDs always win. */
export function reviewTestingIdentities(
  catalogue: { id: string; providerId: string; position: string }[],
  evidence: { canonical_id: string; external_id: string; position: string }[],
) {
  const approved: {
    canonical: string;
    docked: string;
    position: string;
    verifiedIdentity: string;
  }[] = [];
  const quarantined: string[] = [];
  for (const player of catalogue) {
    const matches = evidence.filter((e) => e.external_id === player.providerId);
    if (
      catalogue.filter((p) => p.providerId === player.providerId).length !==
        1 ||
      matches.length !== 1 ||
      matches[0].position !== player.position ||
      !["QB", "RB", "WR", "TE"].includes(player.position)
    ) {
      quarantined.push(player.id);
      continue;
    }
    approved.push({
      canonical: matches[0].canonical_id,
      docked: player.id,
      position: player.position,
      verifiedIdentity: player.providerId,
    });
  }
  return { approved, quarantined };
}
