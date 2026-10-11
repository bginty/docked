import type { Sql } from "postgres";
import {
  executeCredits,
  validateCredits,
  type CreditsState,
} from "../core/credits-sandbox";
import type { Operator } from "../core/commerce-sandbox";
/** Reuses CommerceSandboxStore's single transactional aggregate pattern. Local only,
 * not instantiated by Next routes. Actor comes from trusted operator/test context. */
export class CreditsSandboxStore {
  constructor(private sql: Sql) {}
  async execute(actor: Operator, request: string, command: unknown) {
    return this.sql.begin(async (tx) => {
      const [row] =
        await tx`select revision,document from credits_sandbox.state where id for update`;
      if (!row) throw Error("Financial sandbox not initialized");
      const [{ now }] =
        await tx`select (extract(epoch from clock_timestamp())*1000)::bigint now`;
      const old = row.document as CreditsState;
      const { state, result } = executeCredits(
        old,
        actor,
        request,
        command,
        Number(now),
      );
      if (state.events.length !== old.events.length) {
        for (const j of state.journal.slice(old.journal.length)) {
          await tx`insert into credits_sandbox.journal values(${j.id},${tx.json(j as any)})`;
          for (const [i, line] of j.lines.entries())
            await tx`insert into credits_sandbox.lines values(${j.id},${i},${line.account},${line.credits})`;
        }
        await tx`insert into credits_sandbox.history(revision,actor,request,document) values(${Number(row.revision) + 1},${actor.id},${request},${tx.json(state as any)})`;
        await tx`update credits_sandbox.state set revision=${Number(row.revision) + 1},document=${tx.json(state as any)} where id`;
      }
      return result;
    });
  }
  async read() {
    const [row] = await this
      .sql`select document from credits_sandbox.state where id`;
    const s = row.document as CreditsState;
    validateCredits(s);
    return s;
  }
}
