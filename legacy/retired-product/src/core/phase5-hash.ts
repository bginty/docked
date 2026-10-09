import { createHash } from "node:crypto";
import Decimal from "decimal.js";
/** New Phase5 records use UTF-8 byte ordering, matching SQL COLLATE C.
 * Existing strategy/reference hashes keep their original versioned serializer.
 */
export function phase5Canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(phase5Canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
      .map(([k, v]) => `${JSON.stringify(k)}:${phase5Canonical(v)}`)
      .join(",")}}`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw Error("Finite audit evidence required");
    return new Decimal(value.toString()).toFixed();
  }
  return value === undefined ? "null" : JSON.stringify(value);
}
export const phase5Hash = (value: unknown) =>
  createHash("sha256").update(phase5Canonical(value)).digest("hex");
