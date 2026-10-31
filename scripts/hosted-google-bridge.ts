/** USB transport only. Google verification, durable ledger and refunds execute
 * in the protected hosted service. No local database or wallet is connected. */
import { createServer } from "node:https";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { googleLabHandler } from "../src/server/google-play-lab-http";
import { hostedGoogleCall } from "./hosted-google-client";
async function main() {
  const dir = join(process.env.USERPROFILE!, ".docked-secrets");
  const tls = JSON.parse(
    readFileSync(join(dir, "google-lab-tls.json"), "utf8"),
  );
  const remote = await hostedGoogleCall({ operation: "status" });
  const secret = randomBytes(32).toString("hex"),
    expiresAt = Math.min(Date.now() + 3600_000, remote.expiresAt);
  writeFileSync(
    join(dir, "hosted-google-bridge.json"),
    JSON.stringify({ secret, expiresAt }),
  );
  const server = createServer(
    {
      pfx: readFileSync(join(dir, "google-lab-loopback.p12")),
      passphrase: tls.password,
    },
    googleLabHandler(
      {
        session: () => hostedGoogleCall({ operation: "status" }),
        receipt: (token: string) =>
          hostedGoogleCall({ operation: "receipt", token }),
        reconcile: () => hostedGoogleCall({ operation: "reconcile" }),
        refund: (key: string) => hostedGoogleCall({ operation: "refund", key }),
        pack: (request: string, command: unknown) =>
          hostedGoogleCall({ operation: "pack", request, command }),
      },
      secret,
      expiresAt,
    ),
  );
  server.requestTimeout = 80000;
  await new Promise<void>((resolve) =>
    server.listen(48591, "127.0.0.1", resolve),
  );
  let busy = false;
  const timer = setInterval(() => {
    if (!busy && Date.now() < expiresAt) {
      busy = true;
      void hostedGoogleCall({ operation: "reconcile" })
        .catch(() =>
          console.error("Hosted reconciliation pending; no secrets logged"),
        )
        .finally(() => {
          busy = false;
        });
    }
  }, 30000);
  const stop = () => {
    clearInterval(timer);
    server.closeAllConnections();
    server.close();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  setTimeout(stop, expiresAt - Date.now()).unref();
  console.log(
    "USB bridge ready. All settlement is hosted in the private acceptance schema; no customer wallet connected.",
  );
}
void main().catch(() => {
  console.error("Hosted bridge unavailable; secrets redacted");
  process.exitCode = 1;
});
