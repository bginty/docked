import { teamColours } from "./sport-team-colours";

/** Owner-approved original artwork, October 2026. Canonical keys are resolved
 * through the existing explicit team alias registry, never fuzzy city matching. */
export const aflJerseys = {
  ADE: {
    upper: "#061b35",
    wedge: "#cc102c",
    lower: "#ffd126",
    trim: "#ffd126",
  },
  BRI: {
    upper: "#0646bb",
    wedge: "#ffd126",
    lower: "#790d2b",
    trim: "#ffd126",
  },
  CAR: { upper: "#071b31", lower: "#f2f4f7", trim: "#f2f4f7" },
  COL: { upper: "#111214", lower: "#f2f4f7", trim: "#f2f4f7" },
  ESS: { upper: "#111214", lower: "#df0026", trim: "#df0026" },
  FRE: { upper: "#29104c", lower: "#f2f4f7", trim: "#f2f4f7" },
  GEE: { upper: "#071b31", lower: "#f2f4f7", trim: "#f2f4f7" },
  GCS: { upper: "#df0026", lower: "#ffd126", trim: "#ffd126" },
  GWS: {
    upper: "#ff741c",
    wedge: "#f2f4f7",
    lower: "#202d35",
    trim: "#202d35",
  },
  HAW: { upper: "#402016", lower: "#ffd126", trim: "#ffd126" },
  MEL: { upper: "#071b31", lower: "#df0026", trim: "#df0026" },
  NME: { upper: "#0646bb", lower: "#f2f4f7", trim: "#f2f4f7" },
  POR: {
    upper: "#111214",
    wedge: "#0097a8",
    lower: "#f2f4f7",
    trim: "#f2f4f7",
  },
  RIC: { upper: "#111214", lower: "#ffd126", trim: "#ffd126" },
  STK: {
    upper: "#111214",
    wedge: "#df0026",
    lower: "#f2f4f7",
    trim: "#f2f4f7",
  },
  SYD: { upper: "#df0026", lower: "#f2f4f7", trim: "#f2f4f7" },
  WCE: { upper: "#0646bb", lower: "#ffd126", trim: "#ffd126" },
  WBD: {
    upper: "#0646bb",
    wedge: "#df0026",
    lower: "#f2f4f7",
    trim: "#f2f4f7",
  },
} as const;
export function aflJersey(team?: string) {
  const identity = teamColours("afl", team);
  if (!identity || !Object.hasOwn(aflJerseys, identity.key)) return undefined;
  const colours = aflJerseys[identity.key as keyof typeof aflJerseys];
  return {
    ...colours,
    key: identity.key,
    wedge: "wedge" in colours ? colours.wedge : null,
  };
}
