import type { Sql } from "postgres";
import { digest, results, type ScoringState } from "../core/scoring-engine";

/** Internal operator persistence, deliberately NOT wired to an HTTP mutation route
 * or the member DB role. Current runner accepts only disposable loopback PostgreSQL.
 * A future hosted importer needs a separately reviewed narrow role and feed licence. */
export class ScoringStore {
  constructor(private sql: Sql) {}
  async create(state: ScoringState) {
    await this.sql.begin(async (tx) => {
      const rules = state.period.rules;
      await tx`insert into scoring_beta.rules(version,sport,rules_hash,configuration)
        values(${rules.version},${rules.sport},${digest(rules)},${tx.json(rules)}) on conflict (version) do nothing`;
      const [registered] =
        await tx`select rules_hash from scoring_beta.rules where version=${rules.version}`;
      if (registered.rules_hash !== digest(rules))
        throw Error(
          "Rules version already registered with different configuration",
        );
      await tx`insert into scoring_beta.streams(id,sport,rules_version) values(${state.period.id},${state.period.sport},${rules.version})`;
      await tx`insert into scoring_beta.journal(stream_id,revision,previous_hash,state_hash,body,calculated)
        values(${state.period.id},1,'',${digest(state)},${tx.json(JSON.parse(JSON.stringify(state)))}::jsonb,${tx.json(JSON.parse(JSON.stringify(results(state))))}::jsonb)`;
    });
  }
  async read(id: string): Promise<ScoringState> {
    const rows = await this
      .sql`select state_hash,body,calculated from scoring_beta.journal where stream_id=${id} order by revision desc limit 1`;
    if (
      !rows.length ||
      digest(rows[0].body) !== rows[0].state_hash ||
      digest(results(rows[0].body)) !== digest(rows[0].calculated)
    )
      throw Error("Scoring journal missing or corrupt");
    return rows[0].body as ScoringState;
  }
  async change(
    id: string,
    command: (state: ScoringState) => ScoringState,
  ): Promise<ScoringState> {
    return (await this.sql.begin(async (tx) => {
      const stream =
        await tx`select id from scoring_beta.streams where id=${id} for update`;
      if (!stream.length) throw Error("Unknown scoring period");
      const [old] =
        await tx`select revision,state_hash,body from scoring_beta.journal where stream_id=${id} order by revision desc limit 1`;
      if (digest(old.body) !== old.state_hash)
        throw Error("Scoring journal corrupt");
      const next = command(structuredClone(old.body) as ScoringState);
      if (
        next.period.id !== id ||
        digest(next.period) !== digest(old.body.period) ||
        next.scope !== "simulated-beta"
      )
        throw Error("Immutable period configuration changed");
      const hash = digest(next);
      if (hash === old.state_hash) return next;
      if (
        next.audits.length !== old.body.audits.length + 1 ||
        digest(next.audits.slice(0, -1)) !== digest(old.body.audits)
      )
        throw Error("Invalid audit append");
      if (
        old.body.lineupsLockedAt &&
        digest(old.body.entries) !== digest(next.entries)
      )
        throw Error("Locked teams changed");
      await tx`insert into scoring_beta.journal(stream_id,revision,previous_hash,state_hash,body,calculated)
        values(${id},${old.revision + 1},${old.state_hash},${hash},${tx.json(JSON.parse(JSON.stringify(next)))}::jsonb,${tx.json(JSON.parse(JSON.stringify(results(next))))}::jsonb)`;
      return next;
    })) as unknown as ScoringState;
  }
}
