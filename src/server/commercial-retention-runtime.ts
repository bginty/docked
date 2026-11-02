import "server-only";
import postgres from "postgres";
import { databaseConnectionOptions } from "./database-tls";
import { CommercialRetention } from "./commercial-retention";
let connection: ReturnType<typeof postgres> | undefined;
export async function retentionRuntime() {
  if (process.env.DOCKED_RETENTION_SERVICE !== "true")
    throw Error("Retention service disabled");
  const url = process.env.DOCKED_RETENTION_DATABASE_URL ?? "",
    key = process.env.DOCKED_RETENTION_ARCHIVE_KEY ?? "";
  if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Retention key required");
  connection ??= postgres(url, {
    ...databaseConnectionOptions(url),
    max: 1,
    prepare: false,
  });
  const [r] =
    await connection`select rolsuper,rolbypassrls,pg_has_role(current_user,'docked_retention_worker','member') permitted from pg_roles where rolname=current_user`;
  if (!r?.permitted || r.rolsuper || r.rolbypassrls)
    throw Error("Restricted retention worker required");
  return new CommercialRetention(
    connection,
    Buffer.from(key, "hex"),
    process.env.DOCKED_RETENTION_KEY_ID ?? "v1",
  );
}
