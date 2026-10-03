import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

// Gradle owns and can empty its entire output directory. Archive every APK
// outside that directory before any build, and fail before Gradle on a mismatch.
export function preserveAndroidApks(outputDirectory, archiveDirectory) {
  if (!existsSync(outputDirectory)) return [];
  const preserved = [];
  for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".apk")) continue;
    const source = path.join(outputDirectory, entry.name);
    const digest = hash(source);
    const directory = path.join(archiveDirectory, digest);
    const destination = path.join(directory, entry.name);
    mkdirSync(directory, { recursive: true });
    if (!existsSync(destination))
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
    if (hash(destination) !== digest)
      throw new Error("Preserved Android APK hash mismatch; build stopped.");
    preserved.push({ filename: entry.name, sha256: digest, path: destination });
  }
  return preserved;
}
