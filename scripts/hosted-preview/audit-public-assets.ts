// Read-only inspection. Prints aggregate counts only; never credentials or matching source lines.
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import {
  dockedPreviewProjectRef,
  dockedPreviewOrigin,
} from "../../src/core/preview-auth";

const root = pathToFileURL(path.resolve(process.cwd()) + path.sep);
const directory = new URL("private-data/hosted-preview/", root);
type Counts = {
  files: number;
  secretKeyFiles: number;
  databasePasswordFiles: number;
};
const empty = (): Counts => ({
  files: 0,
  secretKeyFiles: 0,
  databasePasswordFiles: 0,
});
const exists = async (url: URL) =>
  stat(url)
    .then(() => true)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false;
      throw error;
    });
async function main() {
  try {
    if (
      process.argv[2] !== "--inspect-final-build" ||
      process.argv.length !== 3
    )
      throw new Error("explicit final-build inspection required");
    const connection = JSON.parse(
      await readFile(new URL("connection.json", directory), "utf8"),
    ) as {
      projectRef: string;
      organizationId: string;
      supabaseUrl: string;
      databaseUrl: string;
      secretKey: string;
    };
    const bootstrap = JSON.parse(
      await readFile(
        new URL("../hosted-preview-bootstrap.json", directory),
        "utf8",
      ),
    ) as {
      projectRef: string;
      organizationId: string;
      databasePassword: string;
    };
    const databasePassword = decodeURIComponent(
      new URL(connection.databaseUrl).password,
    );
    if (
      connection.projectRef !== dockedPreviewProjectRef ||
      connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
      connection.supabaseUrl !== dockedPreviewOrigin ||
      bootstrap.projectRef !== connection.projectRef ||
      bootstrap.organizationId !== connection.organizationId ||
      databasePassword !== bootstrap.databasePassword ||
      databasePassword.length < 20 ||
      !connection.secretKey.startsWith("sb_secret_")
    )
      throw new Error("verified private credential source required");
    const variants = (value: string) =>
      [
        ...new Set([
          value,
          encodeURIComponent(value),
          JSON.stringify(value).slice(1, -1),
          Buffer.from(value).toString("base64"),
        ]),
      ].map((value) => Buffer.from(value));
    const keyNeedles = variants(connection.secretKey),
      passwordNeedles = variants(databasePassword);
    async function inspect(
      directoryUrl: URL,
      include: (name: string) => boolean = () => true,
    ): Promise<Counts> {
      const counts = empty();
      for (const entry of await readdir(directoryUrl, {
        withFileTypes: true,
      })) {
        if (entry.isSymbolicLink())
          throw new Error("public symlink needs independent review");
        const file = new URL(
          encodeURIComponent(entry.name) + (entry.isDirectory() ? "/" : ""),
          directoryUrl,
        );
        if (entry.isDirectory()) {
          const nested = await inspect(file, include);
          counts.files += nested.files;
          counts.secretKeyFiles += nested.secretKeyFiles;
          counts.databasePasswordFiles += nested.databasePasswordFiles;
        } else if (entry.isFile() && include(entry.name)) {
          const body = await readFile(file);
          counts.files++;
          if (keyNeedles.some((needle) => body.includes(needle)))
            counts.secretKeyFiles++;
          if (passwordNeedles.some((needle) => body.includes(needle)))
            counts.databasePasswordFiles++;
        }
      }
      return counts;
    }
    const browserAssets = await inspect(new URL(".next/static/", root));
    if (!browserAssets.files) throw new Error("completed build required");
    const publicFiles = await inspect(new URL("public/", root));
    const rendered = new URL(".next/server/app/", root);
    const prerenderedPayloads = (await exists(rendered))
      ? await inspect(rendered, (name) =>
          /\.(html|rsc|json|txt|meta|body)$/.test(name),
        )
      : empty();
    const standaloneStatic = new URL(".next/standalone/.next/static/", root);
    const copiedBrowserAssets = (await exists(standaloneStatic))
      ? await inspect(standaloneStatic)
      : empty();
    const standalonePublic = new URL(".next/standalone/public/", root);
    const copiedPublicFiles = (await exists(standalonePublic))
      ? await inspect(standalonePublic)
      : empty();
    const standaloneEnv = new URL(".next/standalone/.env.local", root);
    const standaloneEnvironmentFilePresent = await exists(standaloneEnv);
    const standaloneBody = standaloneEnvironmentFilePresent
      ? await readFile(standaloneEnv)
      : Buffer.alloc(0);
    const scopes = {
      browserAssets,
      publicFiles,
      prerenderedPayloads,
      copiedBrowserAssets,
      copiedPublicFiles,
    };
    const exposedFiles = Object.values(scopes).reduce(
      (total, counts) =>
        total + counts.secretKeyFiles + counts.databasePasswordFiles,
      0,
    );
    const report = {
      projectRef: dockedPreviewProjectRef,
      recordedAt: new Date().toISOString(),
      status: exposedFiles ? "FAIL" : "PASS",
      scopes,
      standaloneEnvironmentFilePresent,
      standaloneServerOnlySecretKeyPresent: keyNeedles.some((needle) =>
        standaloneBody.includes(needle),
      ),
      standaloneServerOnlyDatabasePasswordPresent: passwordNeedles.some(
        (needle) => standaloneBody.includes(needle),
      ),
      limitation:
        "Inspects completed local browser/static/prerender outputs and separate server-only environment copy; does not assert hosted CDN or dynamic-response behavior.",
    };
    await writeFile(
      new URL("docs/qa/hosted-preview/private-asset-audit.json", root),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
    if (exposedFiles) process.exitCode = 1;
  } catch {
    console.error(
      "Private asset audit failed its guards or inspection; no credentials, filenames containing secrets or source content printed.",
    );
    process.exitCode = 1;
  }
}
void main();
