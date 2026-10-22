/** Bounded scheduler entry point for the approved isolated Preview only.
 * Raw ingestion never activates a sport, issues cards, or writes scores. */
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
import { feedSport } from "../src/core/multisport-delivery";
import { pullSportPage } from "../src/server/multisport-refresh";
async function main() {
  const file = process.env.DOCKED_MULTI_CONSUMER_CONFIG;
  if (!file) throw Error("Consumer configuration required");
  const config = z
    .object({
      projectRef: z.literal("bckkllmndoxzpzdqrevb"),
      origin: z.url(),
      dataset: z.uuid(),
      source: z.string().min(1).max(160),
      sports: z.array(feedSport).min(1).max(4),
      allowSynthetic: z.boolean(),
    })
    .strict()
    .parse(JSON.parse(await readFile(file, "utf8")));
  const database = process.env.DOCKED_MULTI_DELIVERY_DATABASE_URL,
    key = process.env.DOCKED_MULTI_FEED_READ_KEY,
    certificate = process.env.DOCKED_MULTI_DATABASE_CA;
  if (!database || !key || !certificate)
    throw Error("Scoped database, CA and read credential required");
  const url = new URL(database),
    username = decodeURIComponent(url.username);
  if (
    !url.hostname.endsWith(".pooler.supabase.com") ||
    !username.startsWith("docked_multi_delivery.") ||
    !username.endsWith("." + config.projectRef) ||
    (url.protocol !== "postgresql:" && url.protocol !== "postgres:")
  )
    throw Error("Dedicated Preview delivery role required");
  const sql = postgres(database, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 10,
    onnotice: () => {},
    ssl: { rejectUnauthorized: true, ca: await readFile(certificate, "utf8") },
  });
  try {
    const [role] =
      await sql`select current_user role,rolbypassrls bypass from pg_roles where rolname=current_user`;
    if (role.role !== "docked_multi_delivery" || role.bypass)
      throw Error("Least-privilege runtime role required");
    for (const sport of [...new Set(config.sports)]) {
      let page = 0,
        more = true;
      while (more && page < 20) {
        const result = await pullSportPage(sql, { ...config, key }, sport);
        more = result.hasMore;
        page++;
      }
      console.log(
        JSON.stringify({
          sport,
          pages: page,
          catchUpPending: more,
          at: new Date().toISOString(),
        }),
      );
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}
main().catch(() => {
  console.error(
    "Multi-sport delivery failed; checkpoint retained. Inspect protected service/database diagnostics.",
  );
  process.exitCode = 1;
});
