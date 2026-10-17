import type { Sql } from "postgres";
import type { FeedDb } from "../../src/server/nfl-testing-store";
/** Tagged-query transport for exercising the UNMODIFIED SportsFeedStore in PGlite. */
export function taggedFeedSql(db: FeedDb): Sql {
  const tag: any = async (strings: TemplateStringsArray, ...values: any[]) => {
    const params: unknown[] = [];
    const query = strings.reduce(
      (s, part, i) =>
        s +
        part +
        (i < values.length
          ? `$${params.push(values[i]?.__json ? JSON.stringify(values[i].value) : values[i])}`
          : ""),
      "",
    );
    return (await db.query(query, params)).rows;
  };
  tag.json = (value: unknown) => ({ __json: true, value });
  tag.begin = (fn: (sql: Sql) => unknown) =>
    db.transaction((tx) => Promise.resolve(fn(taggedFeedSql(tx))));
  return tag;
}
