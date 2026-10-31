// Local TLS only. Does not change system trust, Android trust, Play or any service permission.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = join(process.env.USERPROFILE ?? "", ".docked-secrets");
if (!existsSync(dir))
  throw Error("Existing protected local secrets directory required");
const pfx = join(dir, "google-lab-loopback.p12");
const config = join(dir, "google-lab-tls.json");
const keytool = join(process.env.JAVA_HOME ?? "", "bin/keytool.exe");
if (!existsSync(keytool)) throw Error("Configured JDK required");
let password;
if (existsSync(config))
  password = JSON.parse(readFileSync(config, "utf8")).password;
else {
  if (existsSync(pfx))
    throw Error("Existing TLS key has no config; refusing overwrite");
  password = randomBytes(32).toString("hex");
  writeFileSync(config, JSON.stringify({ password }), { flag: "wx" });
}
const env = { ...process.env, DOCKED_LAB_TLS_PASSWORD: password };
const run = (args) => {
  const r = spawnSync(keytool, args, {
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0)
    throw Error("Local TLS preparation failed; credential output redacted");
  return r.stdout;
};
if (!existsSync(pfx))
  run([
    "-genkeypair",
    "-alias",
    "loopback-lab",
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "30",
    "-dname",
    "CN=Docked USB Test Lab",
    "-ext",
    "SAN=ip:127.0.0.1",
    "-storetype",
    "PKCS12",
    "-keystore",
    pfx,
    "-storepass:env",
    "DOCKED_LAB_TLS_PASSWORD",
    "-keypass:env",
    "DOCKED_LAB_TLS_PASSWORD",
    "-noprompt",
  ]);
const cert = run([
  "-exportcert",
  "-rfc",
  "-alias",
  "loopback-lab",
  "-keystore",
  pfx,
  "-storepass:env",
  "DOCKED_LAB_TLS_PASSWORD",
]);
if (!cert.includes("-----BEGIN CERTIFICATE-----"))
  throw Error("Loopback public certificate missing");
const raw = "android/app/src/storeBillingQa/res/raw";
mkdirSync(raw, { recursive: true });
writeFileSync(join(raw, "google_lab_ca.pem"), cert);
console.log(
  "Local TLS prepared. Only the public loopback certificate goes into the QA-only build. No system trust changed.",
);
