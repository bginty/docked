// Controlled manual research only. No price endpoint, emails, candidate approval or publication.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import researchPolicy from "../../config/football-v1-research-policy.json";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { db } from "../../src/server/db";
import { registerFittedFootballModel } from "../../src/server/football-fitted";
import { recordFootballPrediction } from "../../src/server/model-ledger";
import { phase5Hash } from "../../src/core/phase5-hash";
import { reviewedOpenFootballSources } from "../../src/core/research-source-catalogue";
import { sourceUseDecision } from "../../src/core/research-engine";
import {
  footballTeamMappingVersion,
  canonicalFootballAliases,
  openFootballTeamId,
} from "../../src/core/football-team-mapping";
import { parseOpenFootballDataset } from "../../src/core/openfootball-dataset";
import { hostedPreviewDisabledFlags } from "../../src/core/hosted-preview";
import {
  assertPhase5dConnection,
  assertPhase5dAccount,
  phase5dOrigin,
  type Phase5dJournal,
} from "./phase5d-scope";
import type { ReferenceSql } from "../../src/server/market-reference";

const modelVersion = "football-goals-v1.0.0",
  root = "private-data/phase5d";
async function main() {
  let sql: ReturnType<typeof db> | undefined;
  try {
    const mode = process.argv[2];
    if (
      !["register", "predict", "comparison-readiness"].includes(mode) ||
      process.argv[3] !== "--confirm-project=bckkllmndoxzpzdqrevb"
    )
      throw Error("Exact manual mode and Preview required");
    const c = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    assertPhase5dConnection(c);
    const j: Phase5dJournal = JSON.parse(
      await readFile(root + "/operator.json", "utf8"),
    );
    assertPhase5dAccount(j);
    const client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const user = await client.auth.getUser(j.accessToken!);
    const claims = JSON.parse(
      Buffer.from(j.accessToken!.split(".")[1], "base64url").toString(),
    );
    if (
      user.error ||
      user.data.user?.id !== j.id ||
      claims.aal !== "aal2" ||
      claims.exp * 1000 <= Date.now()
    )
      throw Error("Current genuine MFA required");
    const codeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    if (
      execFileSync(
        "git",
        [
          "status",
          "--porcelain",
          "--untracked-files=all",
          "--",
          "src",
          "scripts",
          "config",
          "supabase",
          "tests",
          "package.json",
          "package-lock.json",
          "next.config.ts",
          "capacitor.config.ts",
        ],
        {
          encoding: "utf8",
        },
      ).trim()
    )
      throw Error("Commit reviewed implementation first");
    Object.assign(process.env, {
      APP_ENV: "preview",
      SUPABASE_ENV: "preview",
      DOCKED_HOSTED_PREVIEW: "true",
      SITE_URL: phase5dOrigin,
      DATABASE_URL: c.databaseUrl,
      DATABASE_SSL_CA_FILE: c.caFile,
      DATABASE_CONNECTION_MODE: "session",
      DATABASE_RUNTIME: "serverless",
      NEXT_PUBLIC_SUPABASE_URL: c.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: c.publishableKey,
      DOCKED_CODE_COMMIT: codeCommit,
      AUTO_PUBLISH_DOCKED_EDGES: "false",
      RESEARCH_AUTOMATION_ENABLED: "false",
      MARKET_DATA_POLLING_ENABLED: "false",
      EDGE_SCANNER_ENABLED: "false",
    });
    for (const flag of hostedPreviewDisabledFlags) process.env[flag] = "false";
    sql = db();
    const [closed] =
      await sql`select (select count(*)::int from private.tip_publications) publications,(select count(*)::int from private.feature_flags where enabled) flags,(select count(*)::int from private.official_record_boundary) official_start`;
    if (Object.values(closed).some((n) => n !== 0))
      throw Error("Closed baseline required");
    const actor = async (tx: ReferenceSql) => {
      await tx`select set_config('request.jwt.claim.sub',${j.id!},true),set_config('request.jwt.claims',${JSON.stringify(claims)},true),set_config('docked.scanner_commit',${codeCommit},true)`;
      await tx`select private.scanner_assert_actor(true)`;
    };
    if (mode === "register") {
      const study = JSON.parse(
        await readFile(root + "/training-study.json", "utf8"),
      );
      if (
        study.report.failures.length ||
        study.report.trainingHash !== phase5Hash(study.training)
      )
        throw Error("Reviewed training manifest required");
      const sources = reviewedOpenFootballSources();
      for (const source of sources)
        if (
          !sourceUseDecision(source, {
            purpose: "MODEL",
            asOfTime: new Date().toISOString(),
            jurisdiction: "AU:NSW",
          }).allowed
        )
          throw Error("Current source rights required");
      const registered = await sql.begin(async (tx) => {
        await actor(tx);
        for (const s of sources)
          await tx`insert into private.football_sporting_sources(id,provider,source_version,rights_reference,purposes,known_at,effective_from,effective_to,approved_by)
          values(${s.sourceId},'openfootball',${s.version},${s.evidenceUrls[0]},array['model_training','derived_probabilities','retained_evidence'],${s.reviewedAt},${s.effectiveFrom},${s.reviewDueAt},${j.id!})`;
        return registerFittedFootballModel(tx, {
          modelVersion,
          codeCommit,
          actorId: j.id!,
          training: study.training,
          sourceIds: sources.map((s) => s.sourceId),
          manifest: {
            ...study.report,
            acceptance: "ACCEPTED_RESEARCH_ONLY",
            qualityReview: "docs/OPENFOOTBALL_EPL_DATA_QUALITY.md",
            fittedCodeCommit: codeCommit,
            researchPolicy,
            researchPolicyHash: phase5Hash(researchPolicy),
            canonicalAliases: canonicalFootballAliases,
            mappingVersion: footballTeamMappingVersion,
          },
        });
      });
      await writeFile(
        "docs/qa/phase5d/model-registration.json",
        JSON.stringify(
          {
            modelVersion,
            codeCommit,
            manifestId: registered.manifestId,
            configHash: registered.configHash,
            fittedHash: registered.fittedHash,
            diagnostics: registered.fit.diagnostics,
            state: "FORWARD_CALIBRATION",
            validationStatus: "UNVALIDATED",
            officialStart: null,
          },
          null,
          2,
        ),
        { flag: "wx" },
      );
      console.log(
        "Independent research fit retained; FORWARD_CALIBRATION only.",
      );
      return;
    }
    const [registered] =
      await sql`select * from private.football_training_manifests where model_version=${modelVersion}`;
    if (!registered || registered.code_commit !== codeCommit)
      throw Error("Exact fitted code revision required");
    if (mode === "comparison-readiness") {
      const predictions =
        await sql`select id,event_id,status,created_at,probabilities,fair_odds from private.football_model_attempts where requested_model_version=${modelVersion} order by created_at,id`;
      if (!predictions.some((p) => p.status === "READY"))
        throw Error("Persist probabilities before comparison readiness");
      // This gate reads policy metadata, not market prices. No unnecessary quota use.
      const [authority] =
        await sql`select count(*)::int approved from private.region_policies where approved and not preview_community_only and 'market_data'=any(features) and effective_from<=clock_timestamp() and least(effective_to,review_at)>clock_timestamp()`;
      if (authority.approved > 0)
        throw Error("Authority changed: review before any price request");
      await writeFile(
        root + "/comparison-research-values.json",
        JSON.stringify(
          {
            policy: researchPolicy,
            policyHash: phase5Hash(researchPolicy),
            outcomes: predictions
              .filter((p) => p.status === "READY")
              .map((p) => ({
                predictionId: p.id,
                eventId: p.event_id,
                probabilities: p.probabilities,
                fairOdds: p.fair_odds,
                minimumPrices: Object.fromEntries(
                  Object.entries(p.probabilities).map(
                    ([outcome, probability]) => [
                      outcome,
                      new Decimal(String(probability)).isZero()
                        ? null
                        : new Decimal(1)
                            .plus(researchPolicy.minimumEstimatedEv)
                            .div(String(probability))
                            .toDecimalPlaces(2, Decimal.ROUND_CEIL)
                            .toFixed(2),
                    ],
                  ),
                ),
                marketReference: null,
                estimatedEv: null,
                comparisonStatus: "UNAVAILABLE",
              })),
          },
          null,
          2,
        ),
        { flag: "wx" },
      );
      await writeFile(
        "docs/qa/phase5d/market-comparison.json",
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            predictionIds: predictions
              .filter((p) => p.status === "READY")
              .map((p) => p.id),
            status: "MARKET_COMPARISON_UNAVAILABLE",
            reason:
              "No ordinary approved model-comparison jurisdiction policy; Preview data-only authority is insufficient",
            marketPricesRead: false,
            providerRequests: 0,
            researchPolicyVersion: researchPolicy.version,
            researchPolicyHash: phase5Hash(researchPolicy),
            minimumEvResearchSetting: researchPolicy.minimumEstimatedEv,
            candidatesCreated: 0,
            noEdgeConclusion: false,
            autoPublish: false,
            officialStart: null,
          },
          null,
          2,
        ),
        { flag: "wx" },
      );
      console.log(
        "Predictions preserved. Comparison unavailable at existing authority gate; no odds requests or candidate.",
      );
      return;
    }
    const source = reviewedOpenFootballSources()[1];
    const dataset = parseOpenFootballDataset(
      JSON.parse(
        await readFile(
          "private-data/phase5c/openfootball-2026-27.json",
          "utf8",
        ),
      ),
      {
        sourceId: source.sourceId,
        sourceVersion: source.version,
        observedAt: "2026-10-04T02:38:21.5860698Z",
      },
    );
    const events =
      await sql`select * from private.events where competition_id='soccer_epl' and status='scheduled' and start_at>clock_timestamp() and start_at<=clock_timestamp()+interval '7 days' order by start_at,id`;
    const jobId = randomUUID(),
      leaseToken = randomUUID();
    await sql`insert into private.job_runs(id,dedupe_key,kind,state,payload,lease_token,lease_until) values(${jobId},${`phase5d-model:${jobId}`},'edge-scan','leased',${sql.json({ origin: "manual", actorId: j.id, actorSessionId: claims.session_id, researchOnly: true })},${leaseToken},clock_timestamp()+interval '10 minutes')`;
    const outcomes = [];
    for (const event of events) {
      const home = canonicalFootballAliases[event.participants[0]],
        away = canonicalFootballAliases[event.participants[1]];
      const matching = dataset.matches.find(
        (m) =>
          openFootballTeamId(m.homeTeam) === home &&
          openFootballTeamId(m.awayTeam) === away,
      );
      if (
        !home ||
        !away ||
        !matching ||
        matching.scoreField !== "ABSENT" ||
        !matching.scheduledTime ||
        DateTime.fromISO(
          `${matching.scheduledDate}T${matching.scheduledTime}`,
          { zone: "Europe/London" },
        ).toMillis() !== new Date(event.start_at).getTime()
      )
        throw Error("Explicit fixture mapping review required");
      await sql.begin(async (tx) => {
        await actor(tx);
        const [existing] =
          await tx`select id from private.football_sporting_inputs where event_id=${event.id} and payload->>'modelVersion'=${modelVersion}`;
        if (existing) return;
        // The workstation can be ahead of PostgreSQL. Retain the authoritative
        // database clock as text so sub-millisecond provenance is not rounded.
        const [clock] = await tx`select clock_timestamp()::text value`;
        const asOfTime = clock.value as string;
        const payload = {
          schemaVersion: "football-fitted-input-v1",
          event: {
            eventId: event.id,
            competitionId: "soccer_epl",
            homeTeamId: home,
            awayTeamId: away,
            sport: "football",
            startAt: new Date(event.start_at).toISOString(),
            status: "scheduled",
            knownAt: asOfTime,
            sourceId: "retained-canonical-fixture-metadata",
          },
          asOfTime,
          calculatedAt: asOfTime,
          codeCommit,
          manifestId: registered.id,
          modelVersion,
          mappingVersion: footballTeamMappingVersion,
          missingRequired: [],
          missingOptional: ["injuries", "lineups", "xg"],
        };
        await tx`insert into private.football_sporting_inputs(event_id,payload,input_hash,as_of_time,input_cutoff,source_ids,created_by)
          select ${event.id},${tx.json(payload)},${phase5Hash(payload)},${asOfTime}::text::timestamptz,input_cutoff,source_ids,${j.id!} from private.football_training_manifests where id=${registered.id}`;
      });
      const result = await recordFootballPrediction({
        eventId: event.id,
        modelVersion,
        windowSeconds: 604800,
        jobId,
        leaseToken,
        idempotencyKey: `initial-week:${modelVersion}:${event.id}`,
      });
      outcomes.push({
        eventId: event.id,
        participants: event.participants,
        startAt: event.start_at,
        ...result,
      });
    }
    await sql`update private.job_runs set state='done',lease_token=null,lease_until=null,last_success=clock_timestamp() where id=${jobId} and lease_token=${leaseToken}`;
    await writeFile(
      root + "/prospective-cohort.json",
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          modelVersion,
          codeCommit,
          cohort:
            "Initial manual observation of every mapped retained EPL fixture within seven days, before any price read",
          windowSeconds: 604800,
          outcomes,
          officialRecordStart: null,
          livePublication: false,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    await writeFile(
      "docs/qa/phase5d/prospective-cohort.json",
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          modelVersion,
          codeCommit,
          cohortHash: phase5Hash(outcomes),
          predictionIds: outcomes.map((o) =>
            o.status === "READY" ? o.prediction.id : o.id,
          ),
          evaluated: outcomes.length,
          predicted: outcomes.filter((o) => o.status === "READY").length,
          abstained: outcomes.filter((o) => o.status === "ABSTAIN").length,
          privateValues:
            "Retained in private model ledger and local evidence; no public recommendation",
          marketReadBeforePrediction: false,
          officialRecordStart: null,
          publications: 0,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        events: outcomes.length,
        predicted: outcomes.filter((o) => o.status === "READY").length,
        abstained: outcomes.filter((o) => o.status === "ABSTAIN").length,
        officialStart: null,
      }),
    );
  } catch (e) {
    await writeFile(
      root + "/model-cycle-error.json",
      JSON.stringify({
        message: e instanceof Error ? e.message : "Unknown",
        code: (e as { code?: string }).code,
      }),
      { mode: 0o600 },
    );
    console.error(
      "Manual model cycle stopped; private diagnostic retained, no credentials printed.",
    );
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 });
  }
}
void main();
