import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import postgres, { type Sql } from "postgres";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import { settleStoreTestReceipt } from "./store-test-settlement";
import type { StoreReceipt } from "./store-purchase-verification";

/** Shared TEST receipt persistence. String connections remain disposable-local only.
 * Hosted acceptance requires an explicitly injected, dedicated least-privilege role.
 * Reuses the existing wallet lock, ledger and audit transaction. Products and
 * authenticated receipt verification must precede this service. There is no
 * public purchase endpoint or production activation path here. */
export class StoreTestInbox {
  get localAcceptance() {
    return this.schema === "credits_sandbox";
  }
  readonly sql: ReturnType<typeof postgres>;
  private schema: "credits_sandbox" | "store_billing_acceptance" =
    "credits_sandbox";
  private admission?: Promise<void>;
  constructor(
    url: string | { hostedAcceptance: Sql },
    private encryptionKey: Buffer,
  ) {
    if (typeof url !== "string") {
      this.schema = "store_billing_acceptance";
      this.sql = url.hostedAcceptance;

      if (encryptionKey.length !== 32)
        throw Error("Store reference encryption key required");
      return;
    }
    const target = new URL(url);
    if (
      target.hostname !== "127.0.0.1" ||
      !/^\/docked_free_play_test_\d+$/.test(target.pathname)
    )
      throw Error("Disposable loopback store test database required");
    if (encryptionKey.length !== 32)
      throw Error("Store reference encryption key required");
    this.sql = postgres(url, { max: 12, onnotice: () => {} });
  }
  private ready() {
    if (this.schema === "store_billing_acceptance")
      return (this.admission ??= this.assertHostedRole());
  }
  private async assertHostedRole() {
    const [role] = await this.sql`select current_user as name,
      has_schema_privilege(current_user,'credits_sandbox','USAGE') as customer_access`;
    if (role.name !== "docked_billing_test" || role.customer_access)
      throw Error("Dedicated isolated billing role required");
    const [marker] = await this
      .sql`select purpose from store_billing_acceptance.control where id`;
    if (marker?.purpose !== "google-test-only-no-customer-wallet")
      throw Error("Isolated acceptance marker required");
  }
  private encrypt(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const content = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), content]).toString("base64");
  }
  private decrypt(value: string) {
    const bytes = Buffer.from(value, "base64"),
      cipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        bytes.subarray(0, 12),
      );
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([
      cipher.update(bytes.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
  async accept(
    receipt: StoreReceipt,
    member: string,
    expectedAccount: string,
    privateReference: string,
  ) {
    if (
      !member ||
      receipt.environment !== "test" ||
      receipt.account !== expectedAccount ||
      !privateReference
    )
      throw Error("Verified, account-bound test receipt required");
    await this.ready();
    let effective = receipt;
    const store = new CreditsSandboxStore(
      this.sql,
      async (tx, state) => {
        if (state.mode !== "financial-sandbox-only" || !state.creditOnly)
          throw Error("Isolated wallet required");
        const [old] =
          await tx`select * from ${tx(this.schema)}.store_receipts where provider=${receipt.provider} and receipt_key=${receipt.key} for update`;
        if (
          old &&
          (old.member_id !== member ||
            ["id", "scope", "sport", "credits", "version"].some(
              (k) =>
                old.product[k] !==
                receipt.product[k as keyof typeof receipt.product],
            ))
        )
          throw Error("Receipt ownership or product conflict");
        if (
          old &&
          (["REVOKED", "CANCELLED"].includes(old.status) ||
            (old.status === "PURCHASED" && receipt.state === "PENDING"))
        )
          effective = { ...receipt, state: old.status };
        await tx`insert into ${tx(this.schema)}.store_receipts(provider,receipt_key,member_id,product,status,encrypted_reference)
        values(${receipt.provider},${receipt.key},${member},${tx.json(receipt.product)},${effective.state},${this.encrypt(privateReference)})
        on conflict(provider,receipt_key) do update set status=excluded.status,updated_at=clock_timestamp()`;
        await tx`insert into ${tx(this.schema)}.store_events(provider,receipt_key,status) values(${receipt.provider},${receipt.key},${receipt.state}) on conflict do nothing`;
      },
      undefined,
      undefined,
      (before, _actor, _request, _command, now) => {
        const settled = settleStoreTestReceipt(
          before,
          effective,
          member,
          expectedAccount,
          now,
        );
        return { state: settled.state, result: { finish: settled.finish } };
      },
      async (tx, _state, result) => {
        if (
          result &&
          typeof result === "object" &&
          "finish" in result &&
          result.finish === true
        )
          await tx`insert into ${tx(this.schema)}.store_outbox(provider,receipt_key) values(${receipt.provider},${receipt.key}) on conflict do nothing`;
        if (["REVOKED", "CANCELLED"].includes(effective.state))
          await tx`update ${tx(this.schema)}.store_outbox set state='cancelled',lease_until=null,updated_at=clock_timestamp() where provider=${receipt.provider} and receipt_key=${receipt.key} and state<>'done'`;
      },
      this.schema,
    );
    const request = createHash("sha256")
      .update(receipt.provider + ":" + receipt.key + ":" + effective.state)
      .digest("hex");
    return store.execute(
      { id: "verified-store-test-provider", role: "payment-provider" },
      request,
      {},
    );
  }
  /** A failed provider acknowledgement leaves the committed wallet untouched.
   * Expiring leases recover worker crashes. Callback must itself be idempotent. */
  async deliverOne(
    finish: (
      provider: string,
      reference: string,
      product: string,
    ) => Promise<void>,
  ) {
    await this.ready();
    const [job] = await this
      .sql`update ${this.sql(this.schema)}.store_outbox o set state='working',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',updated_at=clock_timestamp()
      where (provider,receipt_key) in (select provider,receipt_key from ${this.sql(this.schema)}.store_outbox where state='pending' or (state='working' and lease_until<clock_timestamp()) order by updated_at for update skip locked limit 1)
      returning *`;
    if (!job) return false;
    try {
      const [receipt] = await this
        .sql`select * from ${this.sql(this.schema)}.store_receipts where provider=${job.provider} and receipt_key=${job.receipt_key}`;
      if (receipt.status !== "PURCHASED") {
        await this
          .sql`update ${this.sql(this.schema)}.store_outbox set state='cancelled',lease_until=null where provider=${job.provider} and receipt_key=${job.receipt_key}`;
        return false;
      }
      await finish(
        job.provider,
        this.decrypt(receipt.encrypted_reference),
        receipt.product.id,
      );
      await this
        .sql`update ${this.sql(this.schema)}.store_outbox set state='done',lease_until=null where provider=${job.provider} and receipt_key=${job.receipt_key} and state='working' and attempts=${job.attempts}`;
      return true;
    } catch {
      await this
        .sql`update ${this.sql(this.schema)}.store_outbox set state='pending',lease_until=null where provider=${job.provider} and receipt_key=${job.receipt_key} and state='working' and attempts=${job.attempts}`;
      throw Error("Store acknowledgement failed; retry pending");
    }
  }
  async close() {
    await this.sql.end();
  }
  /** Server worker only. Never serialize this result into customer responses. */
  async reference(key: string) {
    await this.ready();
    const [row] = await this
      .sql`select member_id, encrypted_reference from ${this.sql(this.schema)}.store_receipts where provider='google' and receipt_key=${key}`;
    return row
      ? {
          member: String(row.member_id),
          token: this.decrypt(row.encrypted_reference),
        }
      : null;
  }
  async referenceForToken(token: string) {
    return this.reference(
      createHash("sha256")
        .update("docked.fantasy\0" + token)
        .digest("hex"),
    );
  }
  /** LOCAL harness worker only. Never serialize these references into a client
   * response or logs. Unknown/other-member purchases cannot enter reconciliation. */
  async references(member: string) {
    await this.ready();
    const rows = await this
      .sql`select receipt_key, encrypted_reference from ${this.sql(this.schema)}.store_receipts where provider='google' and member_id=${member} order by updated_at`;
    return rows.map((row) => ({
      key: String(row.receipt_key),
      token: this.decrypt(row.encrypted_reference),
    }));
  }
}
