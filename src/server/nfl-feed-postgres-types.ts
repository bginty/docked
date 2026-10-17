/** FeedDb's portable SQL contract passes JSON as serialized text (also used by
 * PGlite). Postgres.js normally JSON.stringify()s parameters inferred as jsonb,
 * which would turn these documents into JSON strings. Preserve that contract
 * only on the dedicated feed connections; ordinary application clients are unchanged.
 */
export const feedPostgresTypes = {
  serializedJson: {
    to: 114,
    from: [114, 3802],
    serialize: (value: unknown) =>
      typeof value === "string" ? value : JSON.stringify(value),
    parse: (value: string) => JSON.parse(value),
  },
};
