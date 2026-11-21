import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import type { BillingEnvironment } from "../core/commercial-billing";
import { bankInput, type BankInput } from "./redemption-vault";

const uuid = z.string().uuid();
export type WithdrawalBankBinding = {
  member: string;
  destination: string;
  identityRevision: number;
};
export type WithdrawalVaultKeys = {
  active: string;
  values: Record<string, Buffer>;
};

/** Separate, rotatable bank-data keys. Never reuse the receipt token key or
 * local redemption prototype key. Decrypted details are server-memory only. */
export class CommercialWithdrawalVault {
  constructor(
    private environment: BillingEnvironment,
    private keys: WithdrawalVaultKeys,
  ) {
    if (
      !/^[A-Za-z0-9_-]{1,32}$/.test(keys.active) ||
      keys.values[keys.active]?.length !== 32 ||
      Object.entries(keys.values).some(
        ([id, key]) => !/^[A-Za-z0-9_-]{1,32}$/.test(id) || key.length !== 32,
      )
    )
      throw Error("Withdrawal bank protection is not configured");
  }

  private context(binding: WithdrawalBankBinding) {
    uuid.parse(binding.member);
    uuid.parse(binding.destination);
    z.number().int().positive().parse(binding.identityRevision);
    return Buffer.from(
      JSON.stringify([
        "docked-commercial-bank-v1",
        this.environment,
        binding.member,
        binding.destination,
        binding.identityRevision,
      ]),
    );
  }

  seal(input: BankInput, binding: WithdrawalBankBinding) {
    const value = bankInput.parse(input);
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      this.keys.values[this.keys.active],
      iv,
    );
    cipher.setAAD(this.context(binding));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      this.keys.active,
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  open(ciphertext: string, binding: WithdrawalBankBinding): BankInput {
    try {
      const parts = ciphertext.split(".");
      if (parts.length !== 5 || parts[0] !== "v1") throw Error();
      const [, id, ivText, tagText, bodyText] = parts;
      const key = this.keys.values[id];
      if (key?.length !== 32) throw Error();
      const iv = Buffer.from(ivText, "base64url");
      const tag = Buffer.from(tagText, "base64url");
      if (iv.length !== 12 || tag.length !== 16) throw Error();
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(this.context(binding));
      decipher.setAuthTag(tag);
      return bankInput.parse(
        JSON.parse(
          Buffer.concat([
            decipher.update(Buffer.from(bodyText, "base64url")),
            decipher.final(),
          ]).toString("utf8"),
        ),
      );
    } catch {
      throw Error(
        "Bank details could not be verified; review this destination",
      );
    }
  }
}

export function withdrawalDestinationMask(input: BankInput) {
  return `****${bankInput.parse(input).account.slice(-4)}`;
}
