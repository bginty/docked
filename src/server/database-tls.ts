import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { isIP } from "node:net";
import { X509Certificate } from "node:crypto";
import { checkServerIdentity, type ConnectionOptions } from "node:tls";
import type { Options } from "postgres";

/** Keep TLS policy explicit: Postgres.js 'require' encrypts without authenticating the server. */
export function databaseConnectionOptions(
  databaseUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Invalid database connection URL");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !hostname ||
    (!isIP(hostname) && !/^[a-z0-9.-]+$/.test(hostname)) ||
    url.hash
  )
    throw new Error("A single explicit PostgreSQL hostname is required");
  // Installed Postgres.js supports arrays in its parser/BaseOptions, while the
  // public Options alias is narrower. Arrays preserve IPv6 without splitting ':'.
  // Real-driver regression tests cover the parsed target and port for this cast.
  const target = {
    host: [hostname],
    port: [Number(url.port || 5432)],
  } as unknown as Pick<Options<Record<string, never>>, "host" | "port">;
  if (["localhost", "127.0.0.1", "::1"].includes(hostname))
    return { ...target, ssl: false as const };
  const ssl: ConnectionOptions = {
    rejectUnauthorized: true,
    // Bind certificate identity to the parsed target even for an IP-address URL.
    checkServerIdentity: (_reportedHostname, certificate) =>
      checkServerIdentity(hostname, certificate),
  };
  const file =
    env.DATABASE_SSL_CA_FILE ||
    (env.DOCKED_HOSTED_PREVIEW === "true"
      ? join(process.cwd(), "certs", "supabase-prod-ca-2021.crt")
      : undefined);
  if (file) {
    if (!isAbsolute(file))
      throw new Error("DATABASE_SSL_CA_FILE must be an absolute path");
    try {
      const info = statSync(file);
      if (!info.isFile() || info.size === 0 || info.size > 1024 * 1024)
        throw new Error("invalid CA file");
      const pem = readFileSync(file, "utf8");
      const certificates = pem.match(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
      );
      if (!certificates?.length || /PRIVATE KEY/.test(pem))
        throw new Error("public CA certificates required");
      for (const certificate of certificates) {
        const parsed = new X509Certificate(certificate);
        if (
          !parsed.ca ||
          Date.parse(parsed.validFrom) > Date.now() ||
          Date.parse(parsed.validTo) <= Date.now()
        )
          throw new Error("valid CA certificates required");
      }
      ssl.ca = certificates.join("\n");
    } catch {
      // Do not echo a connection URL, credential or host-specific certificate path.
      throw new Error(
        "Database CA trust file is unavailable or invalid; verification remains required",
      );
    }
  }
  // Explicit options take precedence over URL ssl/sslmode and PGSSL in Postgres.js.
  return { ...target, ssl };
}
