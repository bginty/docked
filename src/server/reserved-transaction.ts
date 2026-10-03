import type postgres from "postgres";

const active = new WeakSet<object>();
/** postgres 3.4.x reserved connections do not expose begin() at runtime.
 * Keep every statement on the existing lease, including max:1 pools. */
export async function reservedTransaction<T>(
  connection: postgres.ReservedSql,
  action: (transaction: postgres.ReservedSql) => Promise<T>,
): Promise<T> {
  if (active.has(connection))
    throw new Error("Reserved transaction cannot nest");
  active.add(connection);
  let begun = false;
  try {
    await connection.unsafe("BEGIN");
    begun = true;
    const result = await action(connection);
    await connection.unsafe("COMMIT");
    return result;
  } catch (error) {
    if (begun) {
      try {
        await connection.unsafe("ROLLBACK");
      } catch {
        // Never replace the original failure with a potentially sensitive driver message.
        throw new AggregateError(
          [error],
          "Reserved transaction rollback failed",
        );
      }
    }
    throw error;
  } finally {
    active.delete(connection);
  }
}
