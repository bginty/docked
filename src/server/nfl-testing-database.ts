import "server-only";
import { connectTestingFeedDatabase } from "./nfl-testing-connection";
import {
  nflHostedTarget,
  testingDatabaseTarget,
} from "../core/nfl-hosted-target.mjs";
// Deliberately separate from db(), DATABASE_URL and the production runtime role.
export function openNflTestingDatabase() {
  const raw = process.env.DOCKED_NFL_TEST_DATABASE_URL;
  if (!raw || process.env.VERCEL_ENV === "production")
    throw Error("Isolated NFL testing database is not configured");
  const target = testingDatabaseTarget(raw, process.env.VERCEL_ENV);
  if (target.hosted && target.role !== nflHostedTarget.readerRole)
    throw Error("Read-only NFL reporting credential required");
  return connectTestingFeedDatabase(raw, process.env.VERCEL_ENV);
}
