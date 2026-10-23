// Same read-only, private application recovery snapshot used by prior releases.
process.env.DOCKED_RECOVERY_EVIDENCE =
  "/docs/qa/owned-collection/release/recovery-snapshot.json";
await import("./multisport-release-backup.mts");
