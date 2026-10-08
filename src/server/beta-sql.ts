import type { Sql } from "postgres";

/** Routes trusted static application SQL only. Parameters and JSON never pass
 * through this mapper. This is compatibility plumbing, NOT the security boundary:
 * docked_beta_app has no access to official schemas, functions or records.
 */
export function betaStatement(text: string) {
  return text.replace(
    /\b(public|private|fantasy)\./g,
    (_, schema: string) => `beta_${schema}.`,
  );
}
export function betaSql<T extends Sql>(connection: T): T {
  const wrap = (sql: object): object =>
    new Proxy(sql, {
      apply(target, thisArg, args: unknown[]) {
        const first = args[0];
        if (Array.isArray(first) && Object.hasOwn(first, "raw")) {
          const strings = first.map(betaStatement);
          Object.defineProperty(strings, "raw", { value: strings.slice() });
          return Reflect.apply(
            target as (...a: unknown[]) => unknown,
            thisArg,
            [strings, ...args.slice(1)],
          );
        }
        return Reflect.apply(
          target as (...a: unknown[]) => unknown,
          thisArg,
          args,
        );
      },
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === "unsafe")
          return (text: string, ...args: unknown[]) =>
            value.call(target, betaStatement(text), ...args);
        if (key === "file")
          return () => {
            throw Error(
              "File queries require an explicit reviewed beta migration",
            );
          };
        if (key === "begin" || key === "savepoint")
          return (...args: unknown[]) =>
            value.apply(
              target,
              args.map((arg) =>
                typeof arg === "function" ? (tx: object) => arg(wrap(tx)) : arg,
              ),
            );
        if (key === "reserve")
          return async () => wrap(await value.call(target));
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  return wrap(connection) as T;
}
