import { mkdir } from "node:fs/promises";
await mkdir("docs/qa/global-sport/release", { recursive: true });
process.env.DOCKED_RECOVERY_EVIDENCE =
  "/docs/qa/global-sport/release/recovery-snapshot.json";
await import("./multisport-release-backup.mts");
