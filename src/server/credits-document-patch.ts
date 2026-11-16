import type { PendingQuery, Row, Sql } from "postgres";

type Fragment = PendingQuery<Row[]>;
type Patch =
  | { kind: "replace"; value: unknown }
  | {
      kind: "object";
      remove: string[];
      set: Record<string, unknown>;
      children: [string, Patch][];
    };
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function difference(before: unknown, after: unknown, depth = 0): Patch | null {
  if (Object.is(before, after)) return null;
  if (!object(before) || !object(after) || depth >= 16) {
    return JSON.stringify(before) === JSON.stringify(after)
      ? null
      : { kind: "replace", value: after };
  }
  const remove = Object.keys(before).filter(
    (key) => !Object.hasOwn(after, key),
  );
  const set: Record<string, unknown> = Object.create(null);
  const children: [string, Patch][] = [];
  for (const [key, value] of Object.entries(after)) {
    if (!Object.hasOwn(before, key)) set[key] = value;
    else {
      const patch = difference(before[key], value, depth + 1);
      if (patch?.kind === "replace") set[key] = patch.value;
      else if (patch) children.push([key, patch]);
    }
  }
  return remove.length || Object.keys(set).length || children.length
    ? { kind: "object", remove, set, children }
    : null;
}

/** Reconstruct the complete history document from the locked database row.
 * Only changed JSON fields cross the wire. Paths/values are SQL parameters;
 * arrays are replaced whole. No predicate, ledger or state trigger is skipped.
 * The caller must use the exact PRE-authorisation row and retain its row lock.
 */
export function creditsDocumentPatch(
  sql: Sql,
  beforeJson: string,
  after: unknown,
): Fragment {
  // Match postgres.json's JSON serialization, including omitted undefined keys.
  const patch = difference(
    JSON.parse(beforeJson),
    JSON.parse(JSON.stringify(after)),
  );
  const render = (change: Patch | null, path: string[]): Fragment => {
    let result = path.length
      ? sql`source.document #> ${sql.array(path)}::text[]`
      : sql`source.document`;
    if (!change) return result;
    if (change.kind === "replace")
      return sql`${sql.json(change.value as never)}::jsonb`;
    if (change.remove.length)
      result = sql`(${result}) - ${sql.array(change.remove)}::text[]`;
    let updates = sql`${sql.json(change.set as never)}::jsonb`;
    // Build child values together, then merge the parent ONCE. Repeatedly
    // concatenating the full wallet would copy megabytes for every changed key.
    // SQL punctuation is fixed; every key and value remains a parameter/fragment.
    for (let start = 0; start < change.children.length; start += 25) {
      const batch = change.children.slice(start, start + 25);
      const parts = ["jsonb_build_object("];
      const values: unknown[] = [];
      for (const [index, [key, child]] of batch.entries()) {
        values.push(key, render(child, [...path, key]));
        parts.push("::text,", index === batch.length - 1 ? ")" : ",");
      }
      const strings = Object.assign(parts, { raw: [...parts] });
      const children = sql(
        strings as unknown as TemplateStringsArray,
        ...(values as never[]),
      );
      updates = sql`(${updates}) || (${children})`;
    }
    return sql`(${result}) || (${updates})`;
  };
  return render(patch, []);
}
