import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
export const bankInput = z
  .object({
    holder: z.string().trim().min(2).max(120),
    bsb: z.string().regex(/^\d{6}$/),
    account: z.string().regex(/^\d{5,10}$/),
  })
  .strict();
export type BankInput = z.infer<typeof bankInput>;
export function matchingName(a: string, b: string) {
  return (
    a
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleUpperCase("en-AU") ===
    b.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-AU")
  );
}
/** Explicit per-environment key; never falls back to a bundled/default key. */
export class RedemptionVault {
  constructor(private key: Buffer) {
    if (key.length !== 32) throw Error("Redemption encryption key unavailable");
  }
  seal(value: BankInput, member: string, id: string) {
    bankInput.parse(value);
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", this.key, iv);
    c.setAAD(Buffer.from(`docked-bank:v1:${member}:${id}`));
    const encrypted = Buffer.concat([
      c.update(JSON.stringify(value), "utf8"),
      c.final(),
    ]);
    return [
      "v1",
      iv.toString("base64url"),
      c.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(":");
  }
  open(ciphertext: string, member: string, id: string): BankInput {
    try {
      const [v, iv, tag, body] = ciphertext.split(":");
      if (v !== "v1") throw Error();
      const c = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(iv, "base64url"),
      );
      c.setAuthTag(Buffer.from(tag, "base64url"));
      c.setAAD(Buffer.from(`docked-bank:v1:${member}:${id}`));
      return bankInput.parse(
        JSON.parse(
          Buffer.concat([
            c.update(Buffer.from(body, "base64url")),
            c.final(),
          ]).toString("utf8"),
        ),
      );
    } catch {
      throw Error("Bank destination unavailable; reconciliation required");
    }
  }
}
