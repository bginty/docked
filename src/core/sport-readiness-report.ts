import type { ReadinessPackage, ReadinessDecision } from "./sport-readiness";
export type SportReadinessReport = {
  generatedAt: string;
  catalogue: {
    sport: string;
    position: string;
    status: string;
    count: number;
  }[];
  rosters: {
    sport: string;
    season: string;
    provider: string;
    reviewed: number;
    current_reviewed: number;
    quarantined: number;
    expired: number;
    missing_numbers: number;
    last_observed: string;
  }[];
  issues: {
    sport: string;
    season: string;
    provider: string;
    player_id: string | null;
    status: string;
    reasons: string[];
    observed_at: string;
    expires_at: string;
  }[];
  packages: {
    hash: string;
    body: ReadinessPackage;
    decision: ReadinessDecision | null;
  }[];
  jobs: {
    provider: string;
    state: string;
    count: number;
    last_success: string | null;
  }[];
  issueLimit: number;
  activatedByThisSystem: false;
  privateTesting?: {
    sport: "basketball" | "afl" | "nrl";
    databaseEnabled: boolean;
    allocationEnabled: boolean;
    gameplayEnabled: boolean;
    commerceEnabled: boolean;
    fictionalPlayers: number;
    freeInventoryCards: number;
    issuedTestCards: number;
    products: number;
    packsPurchased: number;
    packsOpened: number;
    openListings: number;
    settledSales: number;
    recordedFees: number;
    competitions: number;
    entries: number;
  }[];
};
