import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { syntheticIdentityPolicy } from "../core/manual-identity";
/** Storage adapter accepts only quarantined bytes. A scanner/safe-renderer must
 * return clean raster previews before review. No permissive production scanner. */
export function identityFileType(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > syntheticIdentityPolicy.maxBytes)
    throw Error("Files must be between 1 byte and 10 MB");
  const b = Buffer.from(bytes);
  let mime: string;
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    mime = "image/png";
  else if (b[0] === 255 && b[1] === 216 && b[2] === 255) mime = "image/jpeg";
  else if (b.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
  else
    throw Error(
      "Unsupported format. Use JPG, PNG or PDF; HEIC is not supported.",
    );
  if (
    mime === "application/pdf" &&
    /\/JavaScript|\/JS\b|\/Launch|\/EmbeddedFile|\/OpenAction|\/AA\b/i.test(
      b.toString("latin1"),
    )
  )
    throw Error("Active PDF content is not accepted");
  return {
    mime,
    bytes: b.length,
    digest: createHash("sha256").update(b).digest("hex"),
  };
}
export interface PrivateIdentityStorage {
  put(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
export interface IdentityScanner {
  scan(
    bytes: Uint8Array,
    mime: string,
  ): Promise<{ clean: boolean; readable: boolean; preview: Uint8Array }>;
}
export class IdentityDocumentVault {
  constructor(
    private storage: PrivateIdentityStorage,
    private key: Buffer,
    private scanner: IdentityScanner,
  ) {
    if (key.length !== 32) throw Error("Identity encryption key unavailable");
  }
  async quarantine(owner: string, bytes: Uint8Array) {
    const info = identityFileType(bytes),
      key = randomUUID(),
      iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(owner + ":" + key));
    const encrypted = Buffer.concat([
      iv,
      cipher.update(bytes),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    await this.storage.put(key, encrypted);
    return { ...info, key, owner, status: "quarantined" as const };
  }
  async inspect(record: { owner: string; key: string; mime: string }) {
    const bytes = await this.decrypt(record);
    const result = await this.scanner.scan(bytes, record.mime);
    if (!result.clean || !result.readable)
      throw Error("Document failed security or readability checks");
    if (identityFileType(result.preview).mime !== "image/png")
      throw Error("Safe raster preview required");
    return result.preview;
  }
  private async decrypt(record: { owner: string; key: string }) {
    const b = Buffer.from(await this.storage.get(record.key)),
      d = createDecipheriv("aes-256-gcm", this.key, b.subarray(0, 12));
    d.setAAD(Buffer.from(record.owner + ":" + record.key));
    d.setAuthTag(b.subarray(-16));
    return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]);
  }
}
export function retentionCandidates(
  rows: { key: string; createdAt: number; hold: boolean; temporary: boolean }[],
  now: number,
  retentionMs: number | null,
) {
  if (retentionMs === null) return [];
  if (!Number.isSafeInteger(retentionMs) || retentionMs <= 0)
    throw Error("Approved retention policy required");
  return rows
    .filter((r) => r.temporary && !r.hold && r.createdAt + retentionMs <= now)
    .map((r) => r.key);
}
