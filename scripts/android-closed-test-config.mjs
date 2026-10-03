import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolveAndroidTarget } from "./android-preview-config.mjs";

export const sideloadCertificate =
  "38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b";
/** Credentials remain process environment only; never copied into assets/arguments.
 * @param {Record<string, string | undefined>} env
 * @param {string} root
 * @param {(file: string) => string} resolveFile
 */
export function closedTestInputs(
  env = process.env,
  root = process.cwd(),
  resolveFile = realpathSync,
) {
  const keys = [
    "DOCKED_UPLOAD_KEYSTORE",
    "DOCKED_UPLOAD_ALIAS",
    "DOCKED_UPLOAD_STORE_PASSWORD",
    "DOCKED_UPLOAD_KEY_PASSWORD",
  ];
  if (keys.some((key) => !env[key]))
    throw new Error(
      "OWNER_ACTION_REQUIRED: upload keystore, alias and password environment variables are required.",
    );
  if (!path.isAbsolute(env.DOCKED_UPLOAD_KEYSTORE))
    throw new Error("Upload keystore must use an absolute path.");
  const keystore = resolveFile(env.DOCKED_UPLOAD_KEYSTORE);
  const relative = path.relative(root, keystore);
  const privateSigning = path.relative(
    path.join(root, "private-data/android-signing"),
    keystore,
  );
  const inWorkspace =
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  const inPrivateSigning =
    !!privateSigning &&
    !privateSigning.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(privateSigning);
  if (inWorkspace && !inPrivateSigning)
    throw new Error(
      "Upload key must be outside tracked source or inside ignored private-data/android-signing.",
    );
  if (
    /debug\.keystore$/i.test(keystore) ||
    env.DOCKED_UPLOAD_ALIAS.toLowerCase() === "androiddebugkey"
  )
    throw new Error(
      "A debug signing key cannot be used for Play closed testing.",
    );
  return { keystore, alias: env.DOCKED_UPLOAD_ALIAS };
}
export function verifyUploadCertificate(pem, now = Date.now()) {
  const cert = new X509Certificate(pem);
  const sha256 = createHash("sha256").update(cert.raw).digest("hex");
  if (
    sha256 === sideloadCertificate ||
    /(?:^|\n)CN=Android Debug(?:\n|$)/i.test(cert.subject)
  )
    throw new Error(
      "Play upload signing refuses the sideload debug certificate.",
    );
  if (
    Date.parse(cert.validFrom) > now ||
    Date.parse(cert.validTo) <=
      Math.max(now, Date.parse("2033-10-23T00:00:00Z"))
  )
    throw new Error("Upload certificate is not valid for the required period.");
  return sha256;
}
export function closedTestPreflight(env = process.env) {
  resolveAndroidTarget({ ...env, CAPACITOR_PREVIEW_MODE: "hosted" });
  const input = closedTestInputs(env);
  const executable = path.join(
    env.JAVA_HOME ?? "",
    "bin",
    process.platform === "win32" ? "keytool.exe" : "keytool",
  );
  if (!env.JAVA_HOME || !existsSync(executable))
    throw new Error("JAVA_HOME must point to the installed JDK21.");
  const result = spawnSync(
    executable,
    [
      "-list",
      "-rfc",
      "-keystore",
      input.keystore,
      "-alias",
      input.alias,
      "-storepass:env",
      "DOCKED_UPLOAD_STORE_PASSWORD",
    ],
    { env, encoding: "utf8", windowsHide: true },
  );
  const pem = result.stdout?.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
  )?.[0];
  if (result.status !== 0 || !pem)
    throw new Error(
      "Upload key verification failed. Check the private keystore, alias and password; no credentials were logged.",
    );
  return {
    certificateSha256: verifyUploadCertificate(pem),
    applicationId: "au.com.docked.app.preview",
    track: "closed-testing-only",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    console.log(
      JSON.stringify({
        status: "READY_FOR_LOCAL_BUNDLE_BUILD",
        ...closedTestPreflight(),
      }),
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Closed-test preflight failed.",
    );
    process.exitCode = 1;
  }
}
