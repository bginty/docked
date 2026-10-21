import { officialPositionMatches } from "./nfl-card-eligibility";
export const officialTeams: Record<string, string> = {
  ARI: "azcardinals",
  ATL: "atlantafalcons",
  BAL: "baltimoreravens",
  BUF: "buffalobills",
  CAR: "panthers",
  CHI: "chicagobears",
  CIN: "bengals",
  CLE: "clevelandbrowns",
  DAL: "dallascowboys",
  DEN: "denverbroncos",
  DET: "detroitlions",
  GB: "packers",
  HOU: "houstontexans",
  IND: "colts",
  JAX: "jaguars",
  KC: "chiefs",
  LAC: "chargers",
  LAR: "therams",
  LV: "raiders",
  MIA: "miamidolphins",
  MIN: "vikings",
  NE: "patriots",
  NO: "neworleanssaints",
  NYG: "giants",
  NYJ: "newyorkjets",
  PHI: "philadelphiaeagles",
  PIT: "steelers",
  SEA: "seahawks",
  SF: "49ers",
  TB: "buccaneers",
  TEN: "tennesseetitans",
  WAS: "commanders",
};
export const officialUrl = (team: string) =>
  officialTeams[team]
    ? `https://www.${officialTeams[team]}.com/team/players-roster/`
    : null;
const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
export const rosterName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export type OfficialRow = {
  name: string;
  position: string;
  section: string;
  profile: string;
  status: "active" | "reserve" | "practice-squad" | "unknown";
};
/** Same official roster table/heading contract as nfl-roster-audit. Fail closed
 * on incomplete pages; never interpret an unavailable page as an empty team. */
export function parseOfficialRoster(html: string, url: string): OfficialRow[] {
  if (html.length > 5_000_000) throw Error("Roster response exceeds limit");
  let section = "Unknown";
  const rows: OfficialRow[] = [];
  for (const m of html.matchAll(/<(h[234]|table)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (m[1].toLowerCase() !== "table") {
      section = plain(m[2]);
      continue;
    }
    const heads = [...m[2].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((x) =>
      plain(x[1]),
    );
    const pos = heads.findIndex((h) => /^Pos/i.test(h));
    if (pos < 0) continue;
    for (const tr of m[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const td = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (x) => x[1],
      );
      if (td.length < 3) continue;
      const link = td[0].match(
        /<a\b[^>]*href=["']([^"']*players-roster[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      if (!link) continue;
      const name = plain(link[2]) || plain(td[0]);
      const status = /practice/i.test(section)
        ? "practice-squad"
        : /reserve|injured|suspended|exempt/i.test(section)
          ? "reserve"
          : /^active(?:\s|$)/i.test(section)
            ? "active"
            : "unknown";
      rows.push({
        name,
        position: plain(td[pos] ?? ""),
        section,
        profile: new URL(link[1], url).href,
        status,
      });
    }
  }
  if (
    rows.length < 45 ||
    rows.length > 110 ||
    !rows.some((r) => r.position === "QB") ||
    rows.some((r) => r.status === "unknown")
  )
    throw Error("Official roster incomplete; retain previous evidence");
  return rows;
}
export function matchKnownRoster(
  rows: OfficialRow[],
  name: string,
  position: string,
) {
  const matched = rows.filter((r) => rosterName(r.name) === rosterName(name));
  return matched.length === 1 &&
    officialPositionMatches(matched[0].position, position)
    ? matched[0]
    : null;
}
