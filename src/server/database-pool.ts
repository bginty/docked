/** Only an explicit deployment setting changes the established local/worker pool. */
export function databasePoolOptions(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.DATABASE_RUNTIME &&
    !["persistent", "serverless"].includes(env.DATABASE_RUNTIME)
  )
    throw new Error("Unsupported database runtime mode");
  return env.DATABASE_RUNTIME === "serverless"
    ? { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 }
    : { max: 5, prepare: false };
}
