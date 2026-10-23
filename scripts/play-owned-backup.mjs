import { mkdir } from "node:fs/promises";
await mkdir("docs/qa/play-owned/release", { recursive: true });
process.env.DOCKED_RECOVERY_EVIDENCE =
  "/docs/qa/play-owned/release/recovery-snapshot.json";
await import("./multisport-release-backup.mts");
