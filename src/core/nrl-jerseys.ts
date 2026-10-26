import { teamColours } from "./sport-team-colours";

/** Original Docked panels inspired by the supplied palette sheet, not club kits.
 * Stable existing identities only; Redcliffe is not an additional franchise. */
type Design = {
  body: string;
  trim: string;
  panel: string;
  accent?: string;
  lower?: string;
  pattern: "band" | "angle" | "split";
  number?: string;
};
export const nrlJerseys: Record<string, Design> = {
  BRI: {
    body: "#650d30",
    trim: "#f3be35",
    panel: "#e6ad25",
    accent: "#f4f4ed",
    pattern: "band",
  },
  CAN: {
    body: "#12822c",
    trim: "#f4f4ed",
    panel: "#e7bd29",
    accent: "#154dba",
    pattern: "band",
  },
  CBY: { body: "#073cad", trim: "#f4f4ed", panel: "#f4f4ed", pattern: "angle" },
  CRO: {
    body: "#65b5df",
    trim: "#151d27",
    panel: "#151d27",
    accent: "#f4f4ed",
    pattern: "band",
    number: "#15202a",
  },
  DOL: {
    body: "#df1233",
    trim: "#f4f4ed",
    panel: "#d7bd71",
    accent: "#f4f4ed",
    pattern: "band",
  },
  MAN: {
    body: "#680e30",
    trim: "#f4f4ed",
    panel: "#f4f4ed",
    accent: "#a36580",
    pattern: "band",
  },
  MEL: {
    body: "#27175c",
    trim: "#f4f4ed",
    panel: "#f4f4ed",
    accent: "#d7b335",
    pattern: "angle",
  },
  NEW: {
    body: "#d61331",
    trim: "#0955ab",
    panel: "#0955ab",
    lower: "#0955ab",
    pattern: "split",
  },
  NQL: {
    body: "#0e203c",
    trim: "#f4f4ed",
    panel: "#dbb033",
    lower: "#f4f4ed",
    pattern: "split",
  },
  PAR: {
    body: "#093eac",
    trim: "#f5c535",
    panel: "#f5c535",
    accent: "#f5c535",
    pattern: "band",
  },
  PEN: {
    body: "#17181a",
    trim: "#333537",
    panel: "#df273b",
    accent: "#e9c633",
    lower: "#187f45",
    pattern: "band",
  },
  SOU: {
    body: "#16843b",
    trim: "#161b1b",
    panel: "#dc2036",
    pattern: "band",
    number: "#ffffff",
  },
  SGI: {
    body: "#f4f4ed",
    trim: "#d91b33",
    panel: "#d91b33",
    pattern: "angle",
    number: "#172333",
  },
  SYD: {
    body: "#10254c",
    trim: "#f4f4ed",
    panel: "#df233c",
    accent: "#f4f4ed",
    pattern: "angle",
  },
  WAR: {
    body: "#102b65",
    trim: "#f4f4ed",
    panel: "#138944",
    accent: "#dc293a",
    pattern: "angle",
  },
  WST: {
    body: "#16191c",
    trim: "#f58923",
    panel: "#f58923",
    accent: "#f4f4ed",
    pattern: "angle",
  },
  GLD: {
    body: "#069bd2",
    trim: "#f4f4ed",
    panel: "#e9b939",
    accent: "#f4f4ed",
    pattern: "band",
  },
};
export function nrlJersey(team?: string) {
  const identity = teamColours("nrl", team);
  const design = identity && nrlJerseys[identity.key];
  return design ? { ...design, key: identity!.key } : undefined;
}
