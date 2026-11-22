import type { Sql } from "postgres";
import { z } from "zod";
import { digest } from "../core/scoring-engine";
import { dormantCommercialPool } from "../core/commercial-pool-plan";
import {
  ownerRosterQuery,
  rosterBatchCommand,
  rosterActivationCommand,
  type OwnerRosterReport,
  type OwnerRosterRow,
  type RosterBatchReceipt,
} from "../core/commercial-player-roster";

type AuthorizeOwner = (tx: Sql) => Promise<void>;
/** Current facts and issuance decisions never rewrite a permanent card. */
export class CommercialPlayerRosterStore {
  constructor(readonly sql: Sql) {}
  async read(
    actor: string,
    authorize: AuthorizeOwner,
    input: unknown,
    options: { all?: boolean } = {},
  ): Promise<OwnerRosterReport> {
    z.uuid().parse(actor);
    const filters = ownerRosterQuery.parse(input);
    return this.sql.begin("isolation level repeatable read", async (raw) => {
      const tx = raw as unknown as Sql;
      await authorize(tx);
      const rows = await tx<
        { value: OwnerRosterRow }[]
      >`select value from commercial_billing.owner_roster_rows(${actor}::uuid) value`;
      const all = rows.map((row) => row.value);
      const compare = new Intl.Collator("en-AU", {
        sensitivity: "base",
        numeric: true,
      });
      const auditClub = (row: OwnerRosterRow) =>
        row.verification === "VERIFIED"
          ? (row.currentClubName ?? "Unattached")
          : [...row.savedClubs].sort(compare.compare).join(" / ") ||
            "Unknown saved club";
      const matchesClub = (row: OwnerRosterRow) =>
        !filters.club ||
        (row.verification === "VERIFIED"
          ? `${row.sport}:${row.currentClubId}` === filters.club
          : row.savedClubs.some(
              (club) =>
                `${row.sport}:saved:${encodeURIComponent(club)}` ===
                filters.club,
            ));
      const ordered = all
        .filter(
          (row) =>
            (filters.sport === "all" || row.sport === filters.sport) &&
            matchesClub(row) &&
            (filters.status === "ALL" || row.registration === filters.status) &&
            (filters.issuance === "ALL" ||
              row.eligibility === (filters.issuance === "ELIGIBLE")) &&
            (filters.verification === "ALL" ||
              row.verification === filters.verification) &&
            (!filters.q ||
              `${row.name} ${row.playerId} ${row.currentClubName ?? ""} ${row.savedClubs.join(" ")} ${row.aliases.map((alias) => alias.providerId).join(" ")}`
                .toLocaleLowerCase("en-AU")
                .includes(filters.q.toLocaleLowerCase("en-AU"))),
        )
        .sort(
          (a, b) =>
            compare.compare(a.sport, b.sport) ||
            compare.compare(auditClub(a), auditClub(b)) ||
            compare.compare(a.name, b.name) ||
            a.playerId.localeCompare(b.playerId),
        );
      const clubs = new Map<string, OwnerRosterReport["clubs"][number]>();
      for (const row of all) {
        if (filters.sport !== "all" && row.sport !== filters.sport) continue;
        if (row.verification === "LEGACY") {
          for (const club of row.savedClubs) {
            const id = `saved:${encodeURIComponent(club)}`;
            clubs.set(`${row.sport}:${id}`, {
              sport: row.sport,
              id,
              name: `${club} (saved card club; unverified)`,
            });
          }
        } else if (row.currentClubId && row.currentClubName) {
          clubs.set(`${row.sport}:${row.currentClubId}`, {
            sport: row.sport,
            id: row.currentClubId,
            name: row.currentClubName,
          });
        }
      }
      const pageSize = 100,
        offset = (filters.page - 1) * pageSize;
      const [{ at }] = await tx<
        { at: Date }[]
      >`select transaction_timestamp() at`;
      return {
        generatedAt: new Date(at).toISOString(),
        filters,
        rows: options.all ? ordered : ordered.slice(offset, offset + pageSize),
        total: ordered.length,
        page: filters.page,
        pageSize,
        hasMore: !options.all && offset + pageSize < ordered.length,
        clubs: [...clubs.values()].sort(
          (a, b) =>
            compare.compare(a.sport, b.sport) ||
            compare.compare(a.name, b.name),
        ),
        summary: {
          verified: ordered.filter((row) => row.verification === "VERIFIED")
            .length,
          legacy: ordered.filter((row) => row.verification === "LEGACY").length,
          eligible: ordered.filter((row) => row.eligibility).length,
          excluded: ordered.filter((row) => !row.eligibility).length,
        },
      };
    });
  }
  async apply(
    actor: string,
    input: unknown,
    authorize: AuthorizeOwner,
  ): Promise<RosterBatchReceipt> {
    z.uuid().parse(actor);
    const command = rosterBatchCommand.parse(input);
    const definitions = command.changes.flatMap((change) =>
      change.registerDefinitions && change.candidate
        ? dormantCommercialPool([change.candidate])
        : [],
    );
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await authorize(tx);
      const [batch] =
        await tx`select * from commercial_billing.apply_roster_batch(${actor}::uuid,${tx.json(command)},${digest(command)},${tx.json(definitions)})`;
      if (!batch) throw Error("Roster batch result unavailable");
      return {
        id: batch.id,
        request: batch.request,
        actor: batch.actor,
        changes: Number(batch.changes),
        newDefinitions: Number(batch.new_definitions),
        createdAt: new Date(batch.created_at).toISOString(),
      };
    });
  }
  /** Separate explicit activation; cannot reactivate previously held definitions. */
  async activate(actor: string, input: unknown, authorize: AuthorizeOwner) {
    z.uuid().parse(actor);
    const command = rosterActivationCommand.parse(input);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await authorize(tx);
      const [result] =
        await tx`select * from commercial_billing.activate_roster_candidate(${actor}::uuid,${tx.json(command)})`;
      if (!result) throw Error("Roster activation result unavailable");
      return {
        id: result.id,
        request: result.request,
        playerId: result.player_id,
        sport: result.sport,
        revision: result.revision,
        createdAt: new Date(result.created_at).toISOString(),
        activatedDefinitions: 5,
      };
    });
  }
}
