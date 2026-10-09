import { createHash } from "node:crypto";
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => compareKeys(a, b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  if (value === undefined) return "null";
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Cannot hash non-finite evidence");
  return JSON.stringify(value);
}
// Pin the original collation rather than inheriting a deployment's locale.
// Preserve the existing digest format for account tokens and audit identities.
export const compareKeys = (a: string, b: string) => a.localeCompare(b, "en");
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
