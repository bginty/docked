import type { Sql } from "postgres";
import {
  executeCredits,
  validateCredits,
  type CreditsState,
} from "../core/credits-sandbox";
import type { Operator } from "../core/commerce-sandbox";
import { validateRedemption } from "../core/redemption";
import { timePurchase, timePurchaseSync } from "./purchase-timing";
import { creditsDocumentPatch } from "./credits-document-patch";
export class CreditsRejected extends Error {}
/** Transactional test aggregate. Hosted callers supply server-derived identity
 * and recheck admission against the locked state before any command executes. */
export class CreditsSandboxStore {
  constructor(
    private sql: Sql,
    private authorize?: (tx: Sql, state: CreditsState) => Promise<void>,
    private prepare?: (
      state: CreditsState,
      command: unknown,
      now: number,
    ) => unknown,
    private persist?: (
      tx: Sql,
      previous: CreditsState,
      current: CreditsState,
    ) => Promise<void>,
    private transition?: (
      state: CreditsState,
      actor: Operator,
      request: string,
      command: unknown,
      now: number,
    ) => ReturnType<typeof executeCredits> & { steps?: CreditsState[] },
    private finalize?: (
      tx: Sql,
      state: CreditsState,
      result: ReturnType<typeof executeCredits>["result"],
    ) => Promise<void>,
    private schema:
      | "credits_sandbox"
      | "store_billing_acceptance"
      | "store_member_acceptance" = "credits_sandbox",
  ) {}
  async execute(
    actor: Operator,
    request: string,
    command: unknown,
    recover?: (tx: Sql) => Promise<{
      result: ReturnType<typeof executeCredits>["result"];
    } | null>,
  ) {
    return timePurchase("purchase_transaction", () =>
      this.sql
        .begin(async (tx) => {
          // Shared ordering with NFL team submissions: no ownership/lock race.
          await timePurchase("purchase_lock", async () => {
            await tx`select pg_advisory_xact_lock(${this.schema === "credits_sandbox" ? 71820342 : 71820343})`;
          });
          // Recheck duplicates after the first commit. The caller rechecks live
          // admission and command identity before returning a read-only replay.
          const recovered = recover
            ? await recover(tx as unknown as Sql)
            : null;
          if (recovered) return recovered.result;
          const row = await timePurchase("purchase_state", async () => {
            const [locked] =
              await tx`select revision,document from ${tx(this.schema)}.state where id for update`;
            return locked;
          });
          if (!row) throw Error("Financial sandbox not initialized");
          const patchable =
            this.schema === "credits_sandbox" &&
            command &&
            typeof command === "object" &&
            "kind" in command &&
            (command.kind === "buy-pack" || command.kind === "open-pack");
          // Authorisation/catalogue preparation may mutate row.document. Capture
          // the exact locked input first so those changes are persisted too.
          const beforeJson = patchable ? JSON.stringify(row.document) : null;
          if (this.authorize)
            await timePurchase("purchase_rules", () =>
              this.authorize!(
                tx as unknown as Sql,
                row.document as CreditsState,
              ),
            );
          const [{ now }] =
            await tx`select (extract(epoch from clock_timestamp())*1000)::bigint now`;
          const old = row.document as CreditsState;
          let executed: ReturnType<typeof executeCredits> & {
            steps?: CreditsState[];
          };
          try {
            executed = timePurchaseSync("purchase_issue", () =>
              (this.transition ?? executeCredits)(
                old,
                actor,
                request,
                this.prepare
                  ? this.prepare(old, command, Number(now))
                  : command,
                Number(now),
              ),
            );
          } catch (error) {
            throw new CreditsRejected(
              error instanceof Error ? error.message : "Rejected command",
            );
          }
          const { state, result } = executed;
          await timePurchase("purchase_persist", async () => {
            if (state.events.length !== old.events.length) {
              // Intermediate aggregate states satisfy existing transition guards.
              // They share this transaction/advisory lock and cannot be observed by
              // other connections. History records the single committed operation.
              for (const step of executed.steps ?? []) {
                validateCredits(step);
                if (step.journal.length !== old.journal.length)
                  throw Error(
                    "Intermediate settlement journal is not supported",
                  );
                await tx`update ${tx(this.schema)}.state set document=${tx.json(step as any)} where id`;
              }
              for (const j of state.journal.slice(old.journal.length)) {
                await tx`insert into ${tx(this.schema)}.journal values(${j.id},${tx.json(j as any)})`;
                for (const [i, line] of j.lines.entries())
                  await tx`insert into ${tx(this.schema)}.lines values(${j.id},${i},${line.account},${line.credits})`;
              }
              if (beforeJson && !executed.steps?.length) {
                const document = creditsDocumentPatch(
                  tx as unknown as Sql,
                  beforeJson,
                  state,
                );
                const inserted = await tx`with source as materialized (
                  select document #> '{}'::text[] document from credits_sandbox.state
                  where id and revision=${Number(row.revision)}
                ) insert into credits_sandbox.history(revision,actor,request,document)
                  select ${Number(row.revision) + 1},${actor.id},${request},${document} from source returning revision`;
                if (inserted.length !== 1)
                  throw Error("Locked wallet revision changed");
              } else
                await tx`insert into ${tx(this.schema)}.history(revision,actor,request,document) values(${Number(row.revision) + 1},${actor.id},${request},${tx.json(state as any)})`;
              // The immutable history row was just inserted in this transaction.
              // Reuse its exact document instead of uploading/parsing it twice.
              if (this.schema === "credits_sandbox")
                await tx`update credits_sandbox.state set revision=${Number(row.revision) + 1},document=(select document from credits_sandbox.history where revision=${Number(row.revision) + 1}) where id`;
              else
                await tx`update ${tx(this.schema)}.state set revision=${Number(row.revision) + 1},document=${tx.json(state as any)} where id`;
              if (this.persist)
                await this.persist(tx as unknown as Sql, old, state);
            }
            // Optional receipt/outbox work commits with the wallet even when an
            // idempotent command or a pending receipt did not change its journal.
            if (this.finalize)
              await this.finalize(tx as unknown as Sql, state, result);
          });
          return result;
        })
        .catch((error: unknown) => {
          // PostgreSQL raised an application guard inside the transaction: the
          // driver has rolled the entire transaction back, so this is conclusive.
          // Transport/timeout failures remain unknown and retain the request ID.
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "P0001"
          )
            throw new CreditsRejected(
              error instanceof Error ? error.message : "Transaction rejected",
            );
          throw error;
        }),
    );
  }
  async read() {
    const [row] = await this
      .sql`select document from ${this.sql(this.schema)}.state where id`;
    const s = row.document as CreditsState;
    validateCredits(s);
    validateRedemption(s);
    return s;
  }
}
