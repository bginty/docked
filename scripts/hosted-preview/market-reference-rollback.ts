import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  buildMarketReference,
  marketReferenceV1,
  type MarketSourceObservation,
} from "../../src/core/market-reference";
import { communityPerformance } from "../../src/core/top-docked";
/** OPERATOR-ONLY. The caller must first verify these genuine GoTrue sessions, including admin MFA.
 * No Auth rows, trigger disabling, committed fixture records, SMTP or external provider calls.
 * All writes are rolled back even after successful assertions. Keep this session private.
 */
type Actor = { userId: string; sessionId: string; aal: "aal1" | "aal2" };
export async function runMarketReferenceRollback(
  connection: postgres.Sql,
  actors: { member: Actor; other: Actor; admin: Actor },
  options: { waitForSettlement: boolean; progress?: (stage: string) => void },
) {
  const hostedRef = "bckkllmndoxzpzdqrevb";
  if (
    !String(connection.options.user).endsWith("." + hostedRef) &&
    !connection.options.host.some(
      (host) => host === "db." + hostedRef + ".supabase.co",
    )
  )
    throw new Error("Exact Docked Preview connection required");
  if (actors.admin.aal !== "aal2")
    throw new Error("Genuine MFA administrator session required");
  const checks: string[] = [];
  class Completed extends Error {}
  try {
    await connection.begin(async (tx) => {
      const pg = {
        query: async <T extends Record<string, unknown>>(
          query: string,
          args: unknown[] = [],
        ) => ({
          rows: (await tx.savepoint((sp) =>
            sp.unsafe<T[]>(query, args as never[]),
          )) as unknown as T[],
        }),
        exec: async (query: string) => {
          await tx.savepoint((sp) => sp.unsafe(query));
        },
      };
      const member = actors.member.userId,
        other = actors.other.userId,
        admin = actors.admin.userId,
        sid = actors.member.sessionId,
        adminSid = actors.admin.sessionId;
      for (const actor of Object.values(actors)) {
        const valid = await pg.query(
          "select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=$1 and s.id=$2 and u.email like 'docked-preview-%@example.invalid' and u.email_confirmed_at is not null and (s.not_after is null or s.not_after>clock_timestamp())",
          [actor.userId, actor.sessionId],
        );
        assert.equal(
          valid.rows.length,
          1,
          "Existing reserved genuine Auth session required",
        );
      }
      assert.equal(
        (
          await pg.query(
            "select 1 from private.roles where user_id=$1 and role in ('owner','admin')",
            [admin],
          )
        ).rows.length,
        1,
      );
      const profile = (
        await pg.query<{ id: string }>(
          "select id from private.social_profiles where user_id=$1 and status='active'",
          [member],
        )
      ).rows[0]?.id;
      const otherProfile = (
        await pg.query<{ id: string }>(
          "select id from private.social_profiles where user_id=$1 and status='active'",
          [other],
        )
      ).rows[0]?.id;
      assert.ok(
        profile && otherProfile,
        "Genuine UI-created social profiles required",
      );
      await pg.query(
        "update public.profiles set country='XX',state='ROLLBACK_QA' where id=any($1::uuid[])",
        [[member, other, admin]],
      );
      const policy = (
        await pg.query<{ id: string }>(
          "insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,evidence) values('XX','ROLLBACK_QA',$1,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 hour',true,18,'{community_social,community_edges,public_profiles,leaderboards}','{fixture-book}','Explicitly authorised isolated rollback-only preview QA; no genuine sporting evidence') returning id",
          [randomUUID()],
        )
      ).rows[0].id;
      await pg.query(
        "insert into private.bookmaker_eligibility(bookmaker,operator_group,region_policy_id,approved,effective_from,effective_to,rights_reference) values('fixture-book','fixture-group',$1,true,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 hour','fictional')",
        [policy],
      );
      await pg.exec(
        "insert into private.sports(id,name) values('football','Fixture football') on conflict do nothing",
      );
      await pg.exec(
        "insert into private.competitions(id,sport_id,rules) values('soccer_epl','football','{}') on conflict do nothing",
      );
      await pg.exec(
        "insert into private.source_health(provider,healthy,last_success,rights_reference,capabilities) values('fixture-odds',true,clock_timestamp(),'fictional-isolated-rights','{\"display\":true,\"retention\":true,\"community_standard_prices\":true}')",
      );
      await pg.exec(
        "update private.feature_flags set enabled=true where key='community_edges'",
      );
      async function claims(who = member, session = sid, aal = "aal1") {
        await pg.query(
          "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
          [who, JSON.stringify({ sub: who, session_id: session, aal })],
        );
      }
      async function market(
        options: {
          classification?: string;
          flags?: string[];
          metadata?: boolean;
          startSeconds?: number;
          sourceAge?: number;
        } = {},
      ) {
        const event = `isolated-${randomUUID()}`,
          id = `snapshot-${randomUUID()}`,
          marketId = `market-${event}`;
        const clock = (
          await pg.query<{ now: Date }>("select clock_timestamp() now")
        ).rows[0].now;
        const now = new Date(clock).getTime(),
          start = new Date(
            now + (options.startSeconds ?? 3600) * 1000,
          ).toISOString(),
          source = new Date(
            now - (options.sourceAge ?? 5) * 1000,
          ).toISOString(),
          received = new Date(now).toISOString();
        const rules = {
          eventId: event,
          competition: "soccer_epl",
          participants: ["Fictional A", "Fictional B"],
          market: "football_1x2",
          period: "full_game",
          overtime: false,
          draw: true,
          line: null,
          settlement: "regulation_90_plus_stoppage",
          outcomes: ["Fictional A", "Draw", "Fictional B"],
        };
        const payload = {
          id,
          bookmaker: "fixture-book",
          operator: "fixture-group",
          approved: true,
          rules,
          prices: { "Fictional A": "2.501", Draw: "3", "Fictional B": "3" },
          sourceAt: source,
          snapshotAt: received,
          receivedAt: received,
          suspended: false,
          ...(options.metadata === false
            ? {}
            : {
                communityMetadata: {
                  sourceKind: "current_provider",
                  sourceType: "bookmaker",
                  receivedByDocked: true,
                  providerEventId: event,
                  observedStartAt: start,
                  priceClass: options.classification ?? "STANDARD_VERIFIED",
                  classificationVersion: "fixture-v1",
                  classificationEvidence:
                    "Fictional classification, isolated test only",
                  promotionFlags: options.flags ?? [],
                },
              }),
        };
        await pg.query(
          `insert into private.events(id,competition_id,participants,start_at,source_mappings) values($1,'soccer_epl',$2,$3,$4)`,
          [
            event,
            tx.json(rules.participants),
            start,
            tx.json({ "fixture-odds": event, "fixture-results": event }),
          ],
        );
        await pg.query(
          `insert into private.markets(id,event_id,rules,rules_hash) values($1,$2,$3,$4)`,
          [marketId, event, tx.json(rules), randomUUID()],
        );
        await pg.query(
          `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,provenance,evidence) values($1,$2,'fixture-odds','fixture-book',$3,$4,$4,$5,'fictional-isolated-rights','forward_paper')`,
          [id, marketId, source, received, tx.json(payload)],
        );
        return { id, marketId, event, start, source, received, rules, payload };
      }
      type Market = Awaited<ReturnType<typeof market>>;
      async function register(m: Market) {
        return (
          await pg.query<{ id: string }>(
            `insert into private.community_quote_evidence(snapshot_id,provider_event_id,observed_start_at,classification,classification_version,classification_evidence,rights_reference,metadata) values($1,'ignored',now(),'STANDARD_VERIFIED','ignored','ignored','ignored','{}') returning id`,
            [m.id],
          )
        ).rows[0].id;
      }
      async function referenceFixture() {
        await claims();
        const m = await market({ startSeconds: 660 });
        await register(m);
        const books = [
          "fixture-book",
          "fixture-second",
          "fixture-pricing-a",
          "fixture-pricing-b",
        ];
        await pg.query(
          "update private.region_policies set operators=$1 where id=$2",
          [books, policy],
        );
        const sources: MarketSourceObservation[] = [];
        for (const [index, bookmaker] of books.entries()) {
          const id = index ? randomUUID() : m.id,
            operator = index ? `fixture-group-${index}` : "fixture-group";
          const payload = {
            ...m.payload,
            id,
            bookmaker,
            operator,
            prices:
              index >= 2
                ? { "Fictional A": "2.10", Draw: "3.60", "Fictional B": "3.60" }
                : {
                    "Fictional A": index ? "2.55" : "2.501",
                    Draw: "3",
                    "Fictional B": "3",
                  },
          };
          if (index) {
            await pg.query(
              `insert into private.bookmaker_eligibility(bookmaker,operator_group,region_policy_id,approved,effective_from,effective_to,rights_reference) values($1,$2,$3,true,now()-interval '1 day',now()+interval '1 day','fictional') on conflict do nothing`,
              [bookmaker, operator, policy],
            );
            await pg.query(
              `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,provenance,evidence) values($1,$2,'fixture-odds',$3,$4,$5,$5,$6,'fictional-isolated-rights','forward_paper')`,
              [
                id,
                m.marketId,
                bookmaker,
                m.source,
                m.received,
                tx.json(payload),
              ],
            );
            await register({ ...m, id });
          }
          sources.push({
            ...payload,
            provider: "fixture-odds",
            sourceKind: "bookmaker",
            licensed: true,
            rightsReference: "fictional-isolated-rights",
            ownershipEvidence: "fictional",
            mappingVerified: true,
            feedHealthy: true,
            priceClass: "STANDARD_VERIFIED",
            classificationVersion: "fixture-v1",
            classificationEvidence:
              "Fictional classification, isolated test only",
            promotionFlags: [],
            provenance: "current_provider",
          } as MarketSourceObservation);
        }
        const configuration = {
          ...marketReferenceV1,
          availabilityBookmakers: books.slice(0, 2),
          pricingBookmakers: books.slice(2),
        };
        const at = new Date(
          (await pg.query<{ at: Date }>("select clock_timestamp() at")).rows[0]
            .at,
        ).toISOString();
        const result = buildMarketReference(
          {
            rules: m.rules as MarketSourceObservation["rules"],
            startAt: m.start,
            observedAt: at,
            selection: "Fictional A",
            sources,
          },
          configuration,
        );
        assert.equal(result.status, "READY");
        if (result.status !== "READY")
          throw new Error("Fixture reference unavailable");
        const r = result.reference;
        async function retain(price = r.decimalPrice) {
          return (
            await pg.query<{ id: string }>(
              `insert into private.market_references(market_id,selection,methodology_version,config_hash,configuration,reference,snapshot_ids,decimal_price,observed_at,region_policy_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
              [
                m.marketId,
                r.selection,
                r.methodologyVersion,
                r.configHash,
                tx.json(configuration),
                tx.json({ ...r, decimalPrice: price }),
                [...r.availability.sourceIds, ...(r.pricing?.sourceIds ?? [])],
                price,
                r.observedAt,
                policy,
              ],
            )
          ).rows[0].id;
        }
        return { m, r, configuration, sources, retain };
      }
      async function submitReference(
        f: Awaited<ReturnType<typeof referenceFixture>>,
        referenceId: string,
        odds = f.r.decimalPrice,
        author = profile,
      ) {
        return (
          await pg.query<{
            id: string;
            odds: string;
            personal_metadata: { price: string };
            pricing_model: string;
          }>(
            `insert into private.community_edges(profile_id,event_id,market_id,provider,provider_event_id,bookmaker,selection,market_rules,sport,competition,odds,verification_rule,start_at,source_at,snapshot_at,received_at,region_policy_id,confirmed_permanent,review_hash,idempotency_key,request_hash,pricing_model,market_reference_id) values($1,$2,$3,'ignored','ignored','ignored',$4,$5,'ignored','ignored',$6,'community-market-reference-v2',$7,$8,$9,$9,$10,true,$11,$12,$11,'market_reference_v1',$13) returning id,odds,pricing_model`,
            [
              author,
              f.m.event,
              f.m.marketId,
              f.r.selection,
              tx.json(f.m.rules),
              odds,
              f.m.start,
              f.m.source,
              f.m.received,
              policy,
              "a".repeat(64),
              randomUUID(),
              referenceId,
            ],
          )
        ).rows[0];
      }

      const f = await referenceFixture(),
        referenceId = await f.retain();
      await assert.rejects(() => f.retain("99"), /lower median/);
      checks.push("reference_price_override_denied");
      await assert.rejects(
        () => submitReference(f, referenceId, "99"),
        /Immutable submission reference/,
      );
      checks.push("community_price_override_denied");
      await assert.rejects(
        () => submitReference(f, referenceId, f.r.decimalPrice, otherProfile),
        /authenticated|member required/i,
      );
      checks.push("cross_user_submission_denied");
      const edge = await submitReference(f, referenceId);
      await pg.query(
        'insert into private.community_edge_personal_notes(edge_id,metadata) values($1,\'{"price":"99","bookmaker":"QA promotional claim","promotional":true}\')',
        [edge.id],
      );
      for (const table of ["market_references", "community_edges"]) {
        const id = table === "market_references" ? referenceId : edge.id;
        await assert.rejects(
          () => pg.query(`delete from private.${table} where id=$1`, [id]),
          /Append-only/,
        );
        await assert.rejects(
          () =>
            pg.query(
              `update private.${table} set ${table === "market_references" ? "decimal_price" : "odds"}=99 where id=$1`,
              [id],
            ),
          /Append-only/,
        );
      }
      checks.push("protected_references_and_ledger_immutable");
      const key = randomUUID();
      await pg.query(
        "insert into private.social_posts(author_id,kind,body,sport,community_edge_id,claim_label,idempotency_key) values($1,'edge','Clearly labelled rollback-only QA fixture','football',$2,'social_only',$3)",
        [profile, edge.id, key],
      );
      assert.equal(
        (
          await pg.query(
            "select 1 from private.social_posts where community_edge_id=$1",
            [edge.id],
          )
        ).rows.length,
        1,
      );
      checks.push("social_projection_atomic_link");
      await claims(admin, adminSid, "aal2");
      await pg.query(
        "insert into private.community_result_sources(provider,rights_reference,approved,reviewed_by,review_at,reason) values('fixture-results','Fictional rollback-only preview authority',true,$1,clock_timestamp()+interval '1 hour','User-authorised rollback-only settlement QA')",
        [admin],
      );
      async function result() {
        const at = new Date(
          (await pg.query<{ at: Date }>("select clock_timestamp() at")).rows[0]
            .at,
        ).toISOString();
        return pg.query(
          "insert into private.community_settlements(edge_id,result,provider,provider_event_id,revision,observed_at,evidence,actor) values($1,'WON','fixture-results',$2,'rollback-v1',$3,$4,'results-provider:fixture-results') returning id",
          [
            edge.id,
            f.m.event,
            at,
            tx.json({
              authorised: true,
              source: "fixture-results",
              sourceEventId: f.m.event,
              revision: "rollback-v1",
              eventId: f.m.event,
              status: "final",
              rules: f.m.rules,
              scores: { "Fictional A": 1, "Fictional B": 0 },
              observedAt: at,
            }),
          ],
        );
      }
      await assert.rejects(() => result(), /Authorised matching/);
      checks.push("settlement_before_event_denied");
      if (options.waitForSettlement) {
        options.progress?.(
          "Waiting for the real database event clock; transaction will roll back.",
        );
        while (true) {
          const at = new Date(
            (await pg.query<{ at: Date }>("select clock_timestamp() at"))
              .rows[0].at,
          ).getTime();
          const wait = Date.parse(f.m.start) - at + 1000;
          if (wait <= 0) break;
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(wait, 30000)),
          );
        }
        const settlement = await result();
        assert.equal(settlement.rows.length, 1);
        const row = (
          await pg.query<{
            id: string;
            profile_id: string;
            submitted_at: Date;
            start_at: Date;
            odds: string;
            standard_units: string;
            verification_rule: string;
            settled_at: Date;
            settlement_id: string;
          }>(
            "select e.*,s.created_at settled_at,s.id settlement_id from private.community_edges e join private.community_settlements s on s.edge_id=e.id where e.id=$1",
            [edge.id],
          )
        ).rows[0];
        const performance = communityPerformance([
          {
            id: row.id,
            profileId: row.profile_id,
            submittedAt: new Date(row.submitted_at).toISOString(),
            startAt: new Date(row.start_at).toISOString(),
            sport: "football",
            odds: String(row.odds),
            units: String(row.standard_units),
            classification: "STANDARD_VERIFIED",
            ruleVersion: row.verification_rule,
            verified: true,
            demo: false,
            official: false,
            integrityClear: true,
            result: "WON",
            settledAt: new Date(row.settled_at).toISOString(),
            settlementId: row.settlement_id,
          },
        ]);
        assert.equal(Number(performance.netUnits), 1.5);
        assert.equal(Number(performance.roi), 150);
        checks.push(
          "positive_settlement_after_actual_clock",
          "top_docked_immutable_2_50_benchmark_ignores_99_promo",
        );
      }
      throw new Completed();
    });
  } catch (error) {
    if (!(error instanceof Completed)) throw error;
  }
  return {
    rolledBack: true,
    checks,
    settlement: options.waitForSettlement
      ? "passed"
      : "not_run_requires_actual_time",
  };
}
