import postgres from "postgres";
let connection: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database not configured");
  return (connection ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    prepare: false,
    ssl: process.env.APP_ENV === "production" ? "require" : undefined,
  }));
}
export async function rateLimit(key: string, limit = 20, seconds = 60) {
  const sql = db();
  const rows =
    await sql`insert into private.rate_limits(key,count,reset_at) values(${key},1,now()+${seconds}*interval '1 second') on conflict(key) do update set count=case when private.rate_limits.reset_at<=now() then 1 else private.rate_limits.count+1 end,reset_at=case when private.rate_limits.reset_at<=now() then now()+${seconds}*interval '1 second' else private.rate_limits.reset_at end returning count`;
  return rows[0].count <= limit;
}
