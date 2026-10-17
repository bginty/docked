// Review-only helpers. No network, database mutations, minting or name-only joins.
export const normalName = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
export const aliases = {
  "00-0036988": "Joshua Palmer",
  "00-0038839": "Mitch Tinsley",
  "00-0040879": "Matt Hibner",
  "00-0035298": "Scotty Miller",
  "00-0037292": "Drew Ogletree",
  "00-0035662": "Hollywood Brown",
};
export const supported = (p) =>
  String(p)
    .split("/")
    .some((p) => ["QB", "RB", "WR", "TE", "FB", "HB"].includes(p));
export const compatible = (official, fantasy) =>
  String(official)
    .split("/")
    .some(
      (p) => p === fantasy || (fantasy === "RB" && ["FB", "HB"].includes(p)),
    );
const college = (s) => normalName(s).replace(/^pennsylvania$/, "penn");
export function corroborate(directory, row) {
  if (!directory?.gsis_id || !row.profile?.startsWith("https://")) return false;
  if (
    ![directory.display_name, aliases[directory.gsis_id]].some(
      (n) => n && normalName(n) === normalName(row.name),
    )
  )
    return false;
  const c = row.cells,
    fields = Object.fromEntries(row.headers.map((h, i) => [h, c[i]]));
  const collegeMatch = String(directory.college_name ?? "")
    .split(";")
    .some((s) => college(s) === college(fields.College));
  const birth = new Date(directory.birth_date),
    at = new Date(row.checkedAt);
  const age =
    at.getUTCFullYear() -
    birth.getUTCFullYear() -
    (at.getUTCMonth() < birth.getUTCMonth() ||
    (at.getUTCMonth() === birth.getUTCMonth() &&
      at.getUTCDate() < birth.getUTCDate())
      ? 1
      : 0);
  // Birth date/age + college corroborate a stable ID. A jersey number may change.
  // When age is explicitly unavailable, require exact height AND weight instead.
  const height = String(fields.HT).match(/^(\d+)-(\d+)$/);
  const dimensions =
    height &&
    Number(height[1]) * 12 + Number(height[2]) === Number(directory.height) &&
    Number(fields.WT) === Number(directory.weight);
  return (
    collegeMatch &&
    ((Number.isFinite(age) && String(age) === fields.Age) ||
      (fields.Age === "N/A" && dimensions))
  );
}
export function rosterDecision(row, position) {
  if (!supported(row.position) || !["QB", "RB", "WR", "TE"].includes(position))
    return "unsupported";
  if (!compatible(row.position, position)) return "position-review";
  if (/Practice|DEV/.test(row.section)) return "practice-squad";
  return row.section === "Active" ? "eligible" : "reserve";
}
export function mappingOutcome(player, identities, appearances) {
  const found = identities.filter((i) => i.external_id === player.providerId);
  if (found.length > 1)
    return {
      status: "mapping-conflict",
      reason: "Multiple canonical IDs for provider ID",
    };
  if (!found.length)
    return {
      status: "no-recorded-appearance",
      reason:
        "No canonical statistics identity in this supplied season dataset; not zero or DNP",
    };
  const i = found[0];
  const allowed =
    i.position === player.position ||
    (player.position === "RB" && ["FB", "HB"].includes(i.position));
  if (!allowed)
    return {
      status: "mapping-conflict",
      canonical: i.canonical_id,
      sourcePosition: i.position,
      reason: "Source/fantasy position needs separate reviewed mapping",
    };
  const games = appearances
    .filter((a) => a.player_id === i.canonical_id && a.season === 2026)
    .reduce((n, a) => n + a.appearances, 0);
  return {
    status: games ? "matched-statistical-identity" : "no-recorded-appearance",
    canonical: i.canonical_id,
    sourcePosition: i.position,
    appearances: games,
  };
}
/** Extract the action applying to a name in a multi-action transaction row.
 * Conservative: ambiguous concatenated sentences are not release evidence. */
export function transactionAction(text, names) {
  // Subject-first clauses must be resolved before scanning neighbouring verbs.
  // Example: "... released ...; TE A and TE B waived/injured; ...".
  for (const clause of text.split(";")) {
    const injury = clause.search(
      /waived[\s,/–-]+injured|waived with an injury designation/i,
    );
    const prefix = clause.slice(0, injury);
    if (
      injury >= 0 &&
      !/waived?|released?|signed|placed?|terminated|traded|activated|elevated|acquired/i.test(
        prefix,
      ) &&
      names.some((n) => normalName(prefix).includes(n))
    )
      return "reserve-review";
  }
  const actions =
    /waived(?:[\s,/–-]+(?:injured|injury))?|waive\b|released?\b|terminated\b|signed\b|re-signed\b|placed?\b|claimed\b|acquired\b|traded\b|activated\b|elevated\b|reserve\/(?:injured|retired|suspended)|reached (?:an )?injury settlement/gi;
  const hits = [...text.matchAll(actions)];
  const contains = (s) => names.some((n) => normalName(s).includes(n));
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i],
      end = hits[i + 1]?.index ?? text.length;
    const segment = text.slice(h.index, end);
    // A verb after a subject list (KC) belongs to that preceding list.
    const before = text.slice(hits[i - 1]?.index ?? 0, h.index);
    const backward =
      /^(waived|released?|placed?|reached.*settlement)$/i.test(h[0]) &&
      /\)\s*$/.test(before) &&
      contains(before);
    if (!contains(segment) && !backward) continue;
    if (/^place/i.test(h[0]) && /^reserve\//i.test(hits[i + 1]?.[0] ?? ""))
      return "reserve-review";
    if (
      /retired|injured|injury designation|suspended/i.test(segment) &&
      !/settlement|released.*injured reserve|waived.*from injured reserve/i.test(
        segment,
      )
    )
      return "reserve-review";
    if (/^(waived|waive|released?|terminated|reached.*settlement)/i.test(h[0]))
      return "released";
    return "unresolved";
  }
  return "unresolved";
}
