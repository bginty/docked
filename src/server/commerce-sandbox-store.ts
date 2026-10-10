import type { Sql } from "postgres";
import {
  executeCommerce,
  type State,
  type Operator,
} from "../core/commerce-sandbox";
/** Only instantiated by the disposable loopback operator harness. No web grants. */
export class CommerceSandboxStore {
  constructor(private sql: Sql) {}
  async execute(actor: Operator, request: string, command: unknown) {
    return this.sql.begin(async (tx) => {
      const [row] =
        await tx`select revision,document from commerce_sandbox.state where id for update`;
      if (!row) throw Error("Synthetic state not initialized");
      const [{ now }] =
        await tx`select (extract(epoch from clock_timestamp())*1000)::bigint now`;
      const { state, result } = executeCommerce(
        row.document as State,
        actor,
        request,
        command,
        Number(now),
      );
      // Idempotent retries never append another revision or allocate another card.
      if (state.events.length !== row.document.events.length) {
        const revision = Number(row.revision) + 1;
        await tx`insert into commerce_sandbox.history(revision,actor,request,document) values(${revision},${actor.id},${request},${tx.json(state as any)})`;
        await tx`update commerce_sandbox.state set revision=${revision},document=${tx.json(state as any)} where id`;
      }
      return result;
    });
  }
}
