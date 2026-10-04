// Fictional isolated UI evidence only. Never imported by an application route or server.
import { createRoot } from "react-dom/client";
import type {
  ResearchDashboard,
  ReviewedResearchItem,
} from "../../src/core/research-contracts";
import type {
  MatchResearchFile,
  PublicResearchFact,
  ResearchSource,
  ResearchFactType,
} from "../../src/core/research-engine";
import { ResearchDashboardView } from "../../src/components/research-admin";
import { MatchResearchView } from "../../src/components/research-file";
import { ManualResearchFactForm } from "../../src/components/research-controls";
import {
  ReviewedResearchList,
  ReviewedResearchCard,
} from "../../src/components/research-content";
import { NotificationCentre } from "../../src/components/notification-centre";
const time = "2026-10-04T00:00:00.000Z";
const source: ResearchSource = {
  schemaVersion: "research-source-v1",
  sourceId: "DEMO-source",
  version: "demo-v1",
  name: "DEMO only permitted source",
  domain: "example.invalid",
  category: "WEATHER",
  accessMethod: "MANUAL",
  endpoint: "https://example.invalid/weather",
  rightsState: "APPROVED_MANUAL_ONLY",
  commercialUse: "ALLOWED",
  publicDisplay: "ALLOWED",
  storage: {
    permission: "ALLOWED",
    maxDays: 30,
    immutableEvidenceAllowed: true,
  },
  derivedUse: "ALLOWED",
  modelUse: "DENIED",
  automation: "DENIED",
  robots: "NOT_APPLICABLE",
  etiquette: { minimumIntervalSeconds: null, maximumRequestsPerDay: null },
  attribution: { label: "DEMO source", url: "https://example.invalid/weather" },
  dataTypes: ["WEATHER_UPDATE"],
  reliability: "TIER_3_RELIABLE_REPORTED",
  jurisdictions: ["AU-NSW"],
  reviewedAt: time,
  reviewDueAt: "2026-10-20T00:00:00.000Z",
  effectiveFrom: time,
  effectiveTo: "2026-10-20T00:00:00.000Z",
  evidenceUrls: ["https://example.invalid/terms"],
  notes: "DEMO only fixture",
};
export const researchDemoDashboard: ResearchDashboard = {
  status: "NOT_CONFIGURED",
  message: "DEMO ONLY: no runtime research source is configured.",
  capabilities: {
    govern: true,
    recordFacts: true,
    editorial: true,
    enqueue: true,
  },
  automationEnabled: false,
  sources: [],
  features: [],
  policies: [],
  models: [],
  matches: [],
  schedules: [],
  jobs: [],
  content: [],
  counts: null,
};
const fact: PublicResearchFact = {
  id: "DEMO-fact-1",
  type: "WEATHER_UPDATE",
  teamId: null,
  playerId: null,
  value: {
    temperatureCelsius: "0",
    windKph: null,
    precipitationMm: null,
    forecastFor: "2026-10-04T12:00:00.000Z",
  },
  confidence: "REPORTED",
  status: "CONFLICTING_EVIDENCE",
  sourceLabel: "DEMO source",
  sourceUrl: "https://example.invalid/weather",
  sourcePublishedAt: null,
  sourceObservedAt: time,
  ingestedAt: time,
  effectiveAt: time,
  expiresAt: "2026-10-04T13:00:00.000Z",
  corroboratingIds: ["DEMO-fact-1"],
  conflictingIds: ["DEMO-fact-2"],
};
const file: MatchResearchFile = {
  schemaVersion: "match-research-v1",
  event: {
    eventId: "DEMO-event",
    competitionId: "DEMO-EPL",
    homeTeam: "DEMO Home",
    awayTeam: "DEMO Away",
    homeTeamId: "DEMO-home",
    awayTeamId: "DEMO-away",
    startAt: "2026-10-04T12:00:00.000Z",
    venue: null,
    status: "scheduled",
  },
  asOfTime: time,
  policyVersion: "DEMO-policy-v1",
  status: "PARTIAL",
  missing: ["CONFIRMED_LINEUP"],
  sections: [
    { key: "WEATHER_VENUE", status: "AVAILABLE", facts: [fact] },
    { key: "CONFIRMED_LINEUP", status: "DATA_NOT_AVAILABLE", facts: [] },
    { key: "HEAD_TO_HEAD", status: "DATA_NOT_AVAILABLE", facts: [] },
  ],
  modelStatus: "NOT_CONFIGURED",
  marketStatus: "SEPARATE_MARKET_DATA",
  factIds: [fact.id],
  snapshotHash: "a".repeat(64),
};
const item: ReviewedResearchItem = {
  id: "00000000-0000-4000-8000-000000000002",
  eventId: "DEMO-event",
  type: "MATCH_UPDATE",
  headline: "DEMO weather context update",
  updatedAt: time,
  snapshotId: "00000000-0000-4000-8000-000000000003",
  file,
  disclaimer: "DISPLAY_CONTEXT_ONLY",
};
const root = createRoot(document.getElementById("demo-root")!);
const factTypes = (
  window as unknown as {
    researchFixtureFactTypes: ResearchFactType[];
  }
).researchFixtureFactTypes;
Object.assign(window, {
  renderResearchFixture: (view: string) =>
    root.render(
      <div className="page research-workspace" data-research-view={view}>
        <h1>DEMO ONLY · research interface</h1>
        <p>
          Fictional presentation fixture. No real sporting data, account or
          source approval.
        </p>
        {view === "preferences" ? (
          <NotificationCentre
            data={{
              status: "ready",
              message: "DEMO preferences only",
              viewer: null,
              items: [],
              unread: 0,
              preferences: null,
            }}
          />
        ) : view === "dashboard" || view === "connected-empty" ? (
          <ResearchDashboardView
            data={
              view === "connected-empty"
                ? {
                    ...researchDemoDashboard,
                    status: "READY",
                    message:
                      "DEMO connected service. No reviewed research source exists.",
                    counts: { facts: 0, snapshots: 0, pendingJobs: 0 },
                  }
                : researchDemoDashboard
            }
            factTypes={factTypes}
          />
        ) : view === "source" ? (
          <ResearchDashboardView
            data={{
              ...researchDemoDashboard,
              status: "READY",
              sources: [
                {
                  id: "00000000-0000-4000-8000-000000000001",
                  configuration: source,
                  current: true,
                  createdAt: time,
                  health: {
                    lastSuccess: null,
                    lastFailure: null,
                    errorCode: null,
                    requestsToday: 0,
                    reservedRequests: 0,
                    lastHttpStatus: null,
                    lastMeasured: null,
                  },
                },
              ],
              counts: { facts: 0, snapshots: 0, pendingJobs: 0 },
            }}
            factTypes={["WEATHER_UPDATE"]}
          />
        ) : view === "form" ? (
          <ManualResearchFactForm
            eventId="DEMO-event"
            sources={[
              {
                id: "00000000-0000-4000-8000-000000000001",
                configuration: source,
              },
            ]}
          />
        ) : view === "detail" ? (
          <div className="research-public">
            <ReviewedResearchCard item={item} headingLevel={2} />
            <MatchResearchView file={file} />
          </div>
        ) : view === "member" ? (
          <ReviewedResearchList
            data={{
              status: "READY",
              items: [item],
            }}
          />
        ) : view === "unsafe-attribution" ? (
          <MatchResearchView
            file={{
              ...file,
              sections: [
                {
                  key: "WEATHER_VENUE",
                  status: "AVAILABLE",
                  facts: [
                    {
                      ...fact,
                      sourceUrl:
                        "https://example.invalid/weather?token=demo-secret-must-not-link",
                    },
                  ],
                },
              ],
            }}
          />
        ) : (
          <MatchResearchView file={file} />
        )}
      </div>,
    ),
});
