import { z } from "zod";
import { commercialCardSnapshot } from "./commercial-presentation";
import { aflConfiguration, nrlConfiguration } from "./sport-configuration";
import nflConfiguration from "../../config/nfl-seven-v1.json";

export const rosterRegistration = z.enum([
  "ACTIVE",
  "DELISTED",
  "RETIRED",
  "UNSIGNED",
  "PENDING_RELIST",
  "UNKNOWN",
]);
export const rosterAvailability = z.enum([
  "AVAILABLE",
  "INJURED",
  "SUSPENDED",
  "UNKNOWN",
]);
export type RosterRegistration = z.infer<typeof rosterRegistration>;
export type RosterAvailability = z.infer<typeof rosterAvailability>;
export type RosterSport = "nfl" | "afl" | "nrl";
const rosterPositions: Record<RosterSport, ReadonlySet<string>> = {
  nfl: new Set(nflConfiguration.slots.flatMap((slot) => slot.positions)),
  afl: new Set(aflConfiguration.slots.flatMap((slot) => slot.positions)),
  nrl: new Set(nrlConfiguration.slots.flatMap((slot) => slot.positions)),
};
export const ownerRosterQuery = z.object({
  sport: z.enum(["all", "nfl", "afl", "nrl"]).default("all"),
  club: z.string().trim().max(500).default(""),
  status: z
    .enum(["ALL", "LEGACY", ...rosterRegistration.options])
    .default("ALL"),
  issuance: z.enum(["ALL", "ELIGIBLE", "EXCLUDED"]).default("ALL"),
  verification: z.enum(["ALL", "VERIFIED", "LEGACY"]).default("ALL"),
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type OwnerRosterQuery = z.infer<typeof ownerRosterQuery>;
export type OwnerRosterRow = {
  playerId: string;
  sport: RosterSport;
  name: string;
  currentClubId: string | null;
  currentClubName: string | null;
  savedClubs: string[];
  registration: RosterRegistration | "LEGACY";
  availability: RosterAvailability;
  verification: "VERIFIED" | "LEGACY";
  eligibility: boolean;
  eligibilityReason: string;
  observedAt: string | null;
  effectiveAt: string | null;
  reviewedAt: string | null;
  evidenceUrl: string | null;
  evidenceHash: string | null;
  revision: string | null;
  existingCards: number;
  definitionCount: number;
  approvedDefinitions: number;
  lifetimeIssued: number;
  aliases: { provider: string; providerId: string }[];
  supply: {
    id: string;
    rarity: string;
    cap: number;
    issued: number;
    remaining: number;
    approved: boolean;
  }[];
};
export type OwnerRosterReport = {
  generatedAt: string;
  filters: OwnerRosterQuery;
  rows: OwnerRosterRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  clubs: { sport: RosterSport; id: string; name: string }[];
  summary: {
    verified: number;
    legacy: number;
    eligible: number;
    excluded: number;
  };
};

export const officialRosterHosts: Record<RosterSport, readonly string[]> = {
  afl: [
    "afl.com.au",
    "aflplayers.com.au",
    "afc.com.au",
    "lions.com.au",
    "carltonfc.com.au",
    "collingwoodfc.com.au",
    "essendonfc.com.au",
    "fremantlefc.com.au",
    "geelongcats.com.au",
    "goldcoastfc.com.au",
    "gwsgiants.com.au",
    "hawthornfc.com.au",
    "melbournefc.com.au",
    "nmfc.com.au",
    "portadelaidefc.com.au",
    "richmondfc.com.au",
    "saints.com.au",
    "sydneyswans.com.au",
    "westcoasteagles.com.au",
    "westernbulldogs.com.au",
  ],
  nrl: [
    "nrl.com",
    "broncos.com.au",
    "raiders.com.au",
    "bulldogs.com.au",
    "sharks.com.au",
    "dolphinsnrl.com.au",
    "titans.com.au",
    "seaeagles.com.au",
    "melbournestorm.com.au",
    "newcastleknights.com.au",
    "cowboys.com.au",
    "parraeels.com.au",
    "penrithpanthers.com.au",
    "rabbitohs.com.au",
    "dragons.com.au",
    "roosters.com.au",
    "warriors.kiwi",
    "weststigers.com.au",
  ],
  nfl: [
    "nfl.com",
    "azcardinals.com",
    "atlantafalcons.com",
    "baltimoreravens.com",
    "buffalobills.com",
    "panthers.com",
    "chicagobears.com",
    "bengals.com",
    "clevelandbrowns.com",
    "dallascowboys.com",
    "denverbroncos.com",
    "detroitlions.com",
    "packers.com",
    "houstontexans.com",
    "colts.com",
    "jaguars.com",
    "chiefs.com",
    "chargers.com",
    "therams.com",
    "raiders.com",
    "miamidolphins.com",
    "vikings.com",
    "patriots.com",
    "neworleanssaints.com",
    "giants.com",
    "newyorkjets.com",
    "philadelphiaeagles.com",
    "steelers.com",
    "seahawks.com",
    "49ers.com",
    "buccaneers.com",
    "tennesseetitans.com",
    "commanders.com",
  ],
};
export function officialRosterSource(sport: RosterSport, value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      officialRosterHosts[sport].some(
        (host) => url.hostname === host || url.hostname.endsWith("." + host),
      )
    );
  } catch {
    return false;
  }
}
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const candidate = z
  .object({
    id: z.string().uuid(),
    sport: z.enum(["nfl", "afl", "nrl"]),
    provider: z.string().trim().min(1).max(80),
    providerId: z.string().trim().min(1).max(160),
    snapshot: commercialCardSnapshot.extend({ synthetic: z.literal(false) }),
    eligiblePositions: z.array(z.string().trim().min(1).max(40)).min(1).max(6),
    source: z
      .object({
        url: z.url(),
        hash,
        checkedAt: z.iso.datetime(),
        license: z.string().trim().min(1).max(200),
        verification: z.string().trim().min(12).max(600),
        permanentIssuanceEligible: z.literal(false),
      })
      .strict(),
  })
  .strict();
const change = z
  .object({
    playerId: z.string().uuid(),
    sport: z.enum(["nfl", "afl", "nrl"]),
    expectedRevision: z.string().uuid().nullable(),
    registration: rosterRegistration,
    availability: rosterAvailability,
    currentClub: z
      .object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(120),
      })
      .strict()
      .nullable(),
    source: z
      .object({
        url: z.url(),
        hash,
        observedAt: z.iso.datetime(),
        effectiveAt: z.iso.datetime(),
      })
      .strict(),
    relistConfirmed: z.boolean().default(false),
    candidate: candidate.optional(),
    registerDefinitions: z.boolean().default(false),
    aliases: z
      .array(
        z
          .object({
            provider: z.string().trim().min(1).max(80),
            providerId: z.string().trim().min(1).max(160),
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (!officialRosterSource(value.sport, value.source.url))
      context.addIssue({
        code: "custom",
        path: ["source", "url"],
        message: "Official league or club source required",
      });
    if (value.registration === "ACTIVE" && !value.currentClub)
      context.addIssue({
        code: "custom",
        path: ["currentClub"],
        message: "An active registered club is required",
      });
    if (
      value.candidate &&
      (value.candidate.id !== value.playerId ||
        value.candidate.sport !== value.sport ||
        value.candidate.source.url !== value.source.url ||
        value.candidate.source.hash !== value.source.hash ||
        value.candidate.source.checkedAt !== value.source.observedAt ||
        value.candidate.eligiblePositions.some(
          (position) => !rosterPositions[value.sport].has(position),
        ) ||
        new Set(value.candidate.eligiblePositions).size !==
          value.candidate.eligiblePositions.length ||
        !value.candidate.eligiblePositions.includes(
          value.candidate.snapshot.position,
        ))
    )
      context.addIssue({
        code: "custom",
        path: ["candidate"],
        message: "Canonical identity, verified position and source must agree",
      });
    if (value.registerDefinitions && !value.candidate)
      context.addIssue({
        code: "custom",
        path: ["candidate"],
        message: "Exact reviewed definition candidate required",
      });
    if (
      value.registerDefinitions &&
      (value.registration !== "ACTIVE" ||
        value.candidate?.snapshot.team !== value.currentClub?.name ||
        value.candidate?.snapshot.status === "inactive")
    )
      context.addIssue({
        code: "custom",
        path: ["registerDefinitions"],
        message:
          "Register dormant definitions only after active registration and the exact current club are verified",
      });
  });
export const rosterBatchCommand = z
  .object({
    request: z.string().uuid(),
    reference: z.string().trim().min(3).max(200),
    confirmed: z.literal(true),
    changes: z.array(change).min(1).max(200),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.changes.map((row) => `${row.sport}:${row.playerId}`))
        .size !== value.changes.length
    )
      context.addIssue({
        code: "custom",
        path: ["changes"],
        message: "One decision per canonical player per batch",
      });
  })
  .transform((value) => ({
    ...value,
    changes: [...value.changes].sort((a, b) =>
      `${a.sport}:${a.playerId}`.localeCompare(`${b.sport}:${b.playerId}`),
    ),
  }));
export type RosterBatchCommand = z.infer<typeof rosterBatchCommand>;
export const rosterActivationCommand = z
  .object({
    request: z.string().uuid(),
    reference: z.string().trim().min(3).max(200),
    confirmed: z.literal(true),
    sport: z.enum(["nfl", "afl", "nrl"]),
    playerId: z.string().uuid(),
    expectedRevision: z.string().uuid(),
    rightsReference: z.string().trim().min(8).max(1000),
  })
  .strict();
export type RosterBatchReceipt = {
  id: string;
  request: string;
  actor: string;
  changes: number;
  newDefinitions: number;
  createdAt: string;
};
