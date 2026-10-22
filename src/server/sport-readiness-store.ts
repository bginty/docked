import type { Sql } from "postgres";
import {
  digest,
  validatePeriodDefinition,
  type Period,
  type ScoringState,
} from "../core/scoring-engine";
import { SportsFeedStore } from "./sports-feed-store";
import { savepointConnection } from "./sql-savepoint";
import {
  reviewRosterBatch,
  rosterReviewPolicy,
} from "../core/sport-roster-review";
import { readinessPackage, evaluateReadiness } from "../core/sport-readiness";

/** Operator-only repository. Web roles have no table writes. Ingestion adds
 * evidence; it cannot mint, grant eligibility, activate a sport or edit a team. */
export class SportReadinessStore {
  constructor(private sql: Sql) {}
  /** Operator-only provisioning after all eleven gates. Does not create member
   * inventory, enter a team, publish a competition or enable a sport flag. */
  async prepareApprovedPeriod(
    packageHash: string,
    period: Period,
    now: string,
  ) {
    return this.sql.begin(async (tx) => {
      const [record] =
        await tx`select body from sports_feed.activation_packages where package_hash=${packageHash} for share`;
      if (!record || digest(record.body) !== packageHash)
        throw Error("Release package unavailable or corrupt");
      const p = readinessPackage.parse(record.body);
      await tx`select pg_advisory_xact_lock(hashtextextended(${`sport-package:${packageHash}`},0))`;
      const [decision] =
        await tx`select action,recorded_at from sports_feed.activation_decisions where package_hash=${packageHash} order by id desc limit 1`;
      const readiness = evaluateReadiness(
        p,
        now,
        packageHash,
        decision
          ? {
              packageHash,
              action: decision.action,
              at: new Date(decision.recorded_at).toISOString(),
            }
          : null,
      );
      if (!readiness.readyForRelease)
        throw Error("All current release gates and owner approval required");
      const sport = p.sport === "football" ? "epl" : p.sport;
      if (
        period.sport !== sport ||
        period.season !== p.season ||
        digest(period.rules) !== p.rulesHash ||
        period.rules.version !== p.scoringVersion ||
        period.lineupVersion !== p.formatVersion ||
        period.competitionMode !== p.mode ||
        period.inventoryScope
      )
        throw Error("Period differs from approved sport, rules or format");
      validatePeriodDefinition(period, now, "authorised");
      if (period.fixtures.some((f) => !f.playerIds.length))
        throw Error("Mapped player coverage required");
      const state: ScoringState = {
        schemaVersion: 1,
        scope: "authorised-free-beta",
        period: structuredClone(period),
        entries: [],
        sources: [],
        finalisedAt: null,
        lineupsLockedAt: null,
        audits: [
          {
            sequence: 1,
            actor: "release-operator",
            action: "period-created",
            at: now,
            reason: `Approved package ${packageHash}; not published`,
            payloadHash: digest({ period, packageHash }),
          },
        ],
      };
      await new SportsFeedStore(savepointConnection(tx)).create(state);
      return { streamId: period.id, published: false, issuedCards: 0 };
    });
  }
  async stageRoster(
    raw: unknown[],
    policyInput: unknown,
    completeTeams: string[],
    now: string,
  ) {
    const policy = rosterReviewPolicy.parse(policyInput);
    const reviews = reviewRosterBatch(raw, policy, now, completeTeams);
    const batchHash = digest({
      raw,
      policy,
      completeTeams: [...completeTeams].sort(),
    });
    return this.sql.begin(async (tx) => {
      // Serialise provider mappings, including simultaneous batches/transfers.
      await tx`select pg_advisory_xact_lock(hashtextextended(${`roster:${policy.sport}:${policy.provider}`},0))`;
      const existing =
        await tx`select row_index,status,reasons from sports_feed.roster_observations where batch_hash=${batchHash} order by row_index`;
      if (existing.length) return { batchHash, replay: true, rows: existing };
      const rows = [];
      for (const [index, review] of reviews.entries()) {
        const c = review.candidate;
        const reasons = [...review.reasons];
        if (c && !reasons.length) {
          const conflicts =
            await tx`select player_id,provider_player_id from sports_feed.player_aliases
            where sport=${policy.sport} and provider=${policy.provider}
            and (provider_player_id=${c.providerPlayerId} or player_id=${c.playerId})`;
          if (
            conflicts.some(
              (r) =>
                r.player_id !== c.playerId ||
                r.provider_player_id !== c.providerPlayerId,
            )
          )
            reasons.push(
              "Provider identity conflict; explicit identity review required",
            );
          if (!reasons.length) {
            await tx`insert into sports_feed.player_identities(sport,player_id) values(${c.sport},${c.playerId}) on conflict do nothing`;
            await tx`insert into sports_feed.player_aliases(sport,provider,provider_player_id,player_id,evidence_hash)
              values(${c.sport},${c.provider},${c.providerPlayerId},${c.playerId},${c.evidence.sha256}) on conflict do nothing`;
          }
        }
        const status = reasons.length ? "quarantined" : "ready-for-review";
        const observed = c?.evidence.observedAt ?? now;
        // Bad future timestamps remain quarantined without violating DB chronology.
        const observation =
          Date.parse(observed) > Date.parse(now) ? now : observed;
        const expiry = new Date(
          Math.min(
            Date.parse(policy.rightsExpiresAt),
            Date.parse(observation) + policy.maxAgeHours * 3600000,
          ),
        ).toISOString();
        await tx`insert into sports_feed.roster_observations(batch_hash,row_index,sport,season,provider,player_id,observed_at,expires_at,status,reasons,candidate)
          values(${batchHash},${index},${policy.sport},${policy.season},${policy.provider},${c?.playerId ?? null},${observation},${expiry},${status},${tx.json(reasons)},${tx.json(c)})`;
        rows.push({ row_index: index, status, reasons });
      }
      return { batchHash, replay: false, rows };
    });
  }
  async stagePackage(input: unknown, now: string) {
    const p = readinessPackage.parse(input),
      hash = digest(p);
    const readiness = evaluateReadiness(p, now, hash);
    await this
      .sql`insert into sports_feed.activation_packages(package_hash,sport,season,mode,body)
      values(${hash},${p.sport},${p.season},${p.mode},${this.sql.json(p)}) on conflict do nothing`;
    return { hash, ...readiness };
  }
}
